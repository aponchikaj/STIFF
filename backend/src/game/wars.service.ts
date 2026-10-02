import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { LeaderLockService } from '../common/redis/leader-lock.service';
import { returnedRows } from '../common/utils/returned-rows';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/user.entity';
import { EconomyService } from './economy.service';
import { GameClan, GameClanMember } from './entities/game-clan.entity';
import {
  GameClanWar,
  GameWarBet,
  type WarOutcome,
  type WarStatus,
} from './entities/game-clan-war.entity';
import { GameEnrolment } from './entities/game-enrolment.entity';
import { EnrolmentsService } from './enrolments.service';
import {
  settleWarBook,
  WAR_DURATION_HOURS,
  WAR_JUDGING_DEADLINE_HOURS,
  WAR_MAX_LEAD_DAYS,
  WAR_MIN_LEAD_MINUTES,
  WAR_MIN_STAKE_COINS,
  warMaxStake,
  warRakePercent,
  type WarSide,
} from './rules';
import { SeasonsService } from './seasons.service';

const HOUR = 3_600_000;
const MINUTE = 60_000;

/** A war as anyone may read it. No bettor is named. */
export interface WarView {
  id: string;
  status: WarStatus;
  challenger: { clanId: string; name: string; score: number };
  opponent: { clanId: string; name: string; score: number };
  startsAt: string;
  endsAt: string;
  /** True while a bet can still be placed. */
  bookOpen: boolean;
  pools: Record<WarSide, number>;
  bettors: number;
  /**
   * What one coin on each side would return if the war ended now, with the
   * rake taken — the number a bettor actually wants. Null for a side nobody
   * has backed, because the honest answer is "your stake back".
   */
  returnPerCoin: Record<WarSide, number | null>;
  rakePercent: number;
  outcome: WarOutcome | null;
  winnerClanId: string | null;
  settlementReason: string | null;
  voidReason: string | null;
  settledAt: string | null;
  /** The reader's own bet, if they have one. */
  myBet: {
    side: WarSide;
    stake: number;
    payout: number;
    settled: boolean;
  } | null;
  /** Whether the reader is barred from betting, and why. */
  canBet: { allowed: boolean; reason: string | null };
}

export interface TickReport {
  started: number;
  ended: number;
  settled: number;
  voided: number;
}

/**
 * Clan wars, and the coin book on each one.
 *
 * **Coins, never money.** A book on real money is a licensed gambling
 * operation, the game admits sixteen-year-olds, and the shop's card
 * provider does not cover gambling. None of that is a gap this service
 * leaves for later: there is no path from a bet to cash, and there should
 * not be one.
 *
 * **Integrity rules the book holds:**
 *
 * - Nobody in either clan can bet on the war. A clan member who can back
 *   the other side can profit from throwing the match.
 * - A flagged cheater cannot bet.
 * - The book closes the moment the war starts, so nobody bets knowing how it
 *   is going.
 * - One bet per person per war; a top-up raises it, on the same side only.
 * - Stakes leave the balance when placed, so an unpaid bet cannot exist.
 *
 * **Every transition is a locked row.** Proposing and accepting lock both
 * clans, so neither can end up in two wars. Betting locks the war, so a bet
 * cannot land after the book closed. Settling locks the war and its bets,
 * so a cron and an admin pressing settle cannot both pay out.
 */
@Injectable()
export class WarsService {
  private readonly logger = new Logger(WarsService.name);

  constructor(
    @InjectRepository(GameClanWar)
    private readonly warRepo: Repository<GameClanWar>,
    @InjectRepository(GameWarBet)
    private readonly betRepo: Repository<GameWarBet>,
    @InjectRepository(GameClan)
    private readonly clanRepo: Repository<GameClan>,
    @InjectRepository(GameClanMember)
    private readonly memberRepo: Repository<GameClanMember>,
    private readonly dataSource: DataSource,
    private readonly seasons: SeasonsService,
    private readonly enrolments: EnrolmentsService,
    private readonly economy: EconomyService,
    private readonly notifications: NotificationsService,
    private readonly leaderLock: LeaderLockService,
    private readonly config: ConfigService,
  ) {}

  // ================================================================ lifecycle

  /**
   * A leader challenges another clan.
   *
   * `startsAt` defaults to an hour from now. It has to leave the book open
   * long enough for anyone to bet — at least half an hour — and no further
   * out than a week.
   */
  async propose(
    user: User,
    input: { opponentClanId: string; startsAt?: string },
  ): Promise<WarView> {
    const me = await this.enrolments.require(user, 'player');
    const season = await this.seasons.requireCurrent();
    if (season.status !== 'running') {
      throw new ConflictException(
        'Wars can only be fought while the season is running.',
      );
    }

    const startsAt = this.parseStart(input.startsAt);
    const endsAt = new Date(startsAt.getTime() + WAR_DURATION_HOURS * HOUR);

    const warId = await this.dataSource.transaction(async (m) => {
      const mine = await this.leaderClanOf(m, me.id);
      if (mine.id === input.opponentClanId) {
        throw new BadRequestException('A clan cannot go to war with itself.');
      }
      const opponent = await this.lockClans(m, [
        mine.id,
        input.opponentClanId,
      ]).then((clans) => clans.find((c) => c.id === input.opponentClanId));
      if (!opponent || opponent.seasonId !== season.id) {
        throw new NotFoundException('That clan is not in this season.');
      }
      if (opponent.status !== 'full') {
        throw new ConflictException(
          'That clan has not filled its second seat yet.',
        );
      }
      await this.assertNotAtWar(m, [mine.id, opponent.id]);

      const [row] = returnedRows(
        await m.query(
          `INSERT INTO "game_clan_wars"
             ("seasonId", "challengerClanId", "opponentClanId", "proposedById",
              "status", "startsAt", "endsAt")
           VALUES ($1, $2, $3, $4, 'proposed', $5, $6)
           RETURNING "id"`,
          [season.id, mine.id, opponent.id, me.id, startsAt, endsAt],
        ),
      ) as { id: string }[];
      return row.id;
    });

    const war = await this.load(warId);
    await this.tellClan(
      war.opponentClanId,
      'You have been challenged',
      `${war.challengerClan.name} wants a war starting ${this.when(war.startsAt)}. Your leader can accept or decline.`,
    );
    return this.view(war, me);
  }

  /** The opponent's leader agrees. The book opens now. */
  async accept(user: User, warId: string): Promise<WarView> {
    const me = await this.enrolments.require(user, 'player');

    await this.dataSource.transaction(async (m) => {
      const war = await this.lockWar(m, warId);
      if (war.status !== 'proposed') {
        throw new ConflictException('That challenge is no longer open.');
      }
      const mine = await this.leaderClanOf(m, me.id);
      if (mine.id !== war.opponentClanId) {
        throw new ForbiddenException(
          "Only the challenged clan's leader can accept.",
        );
      }
      if (war.startsAt.getTime() - Date.now() < WAR_MIN_LEAD_MINUTES * MINUTE) {
        throw new ConflictException(
          'It is too close to the start for anyone to bet. Ask for a new challenge.',
        );
      }
      // Both clans, again, inside the lock: either could have gone to war
      // with somebody else since this challenge was made.
      const clans = await this.lockClans(m, [
        war.challengerClanId,
        war.opponentClanId,
      ]);
      if (clans.some((c) => c.status !== 'full')) {
        throw new ConflictException('Both clans need a full roster to fight.');
      }
      await this.assertNotAtWar(
        m,
        [war.challengerClanId, war.opponentClanId],
        war.id,
      );

      await m.query(
        `UPDATE "game_clan_wars"
            SET "status" = 'accepted', "acceptedAt" = now(),
                "rakePercent" = $2, "updatedAt" = now()
          WHERE "id" = $1`,
        [war.id, warRakePercent(this.config)],
      );
    });

    const war = await this.load(warId);
    await this.tellClan(
      war.challengerClanId,
      'Challenge accepted',
      `${war.opponentClan.name} accepted. The war starts ${this.when(war.startsAt)}.`,
    );
    return this.view(war, me);
  }

  /** The challenged leader says no. Nothing was staked, so nothing moves. */
  async decline(user: User, warId: string): Promise<WarView> {
    const me = await this.enrolments.require(user, 'player');
    await this.dataSource.transaction(async (m) => {
      const war = await this.lockWar(m, warId);
      if (war.status !== 'proposed') {
        throw new ConflictException('That challenge is no longer open.');
      }
      const mine = await this.leaderClanOf(m, me.id);
      if (mine.id !== war.opponentClanId) {
        throw new ForbiddenException(
          "Only the challenged clan's leader can decline.",
        );
      }
      await this.markVoid(m, war, 'Declined by the challenged clan.');
    });
    const war = await this.load(warId);
    await this.tellClan(
      war.challengerClanId,
      'Challenge declined',
      `${war.opponentClan.name} declined the war.`,
    );
    return this.view(war, me);
  }

  /**
   * The challenger withdraws. Allowed until the war starts, and it refunds
   * the book — once bets are down, calling it off must not cost anyone.
   */
  async withdraw(user: User, warId: string): Promise<WarView> {
    const me = await this.enrolments.require(user, 'player');
    await this.dataSource.transaction(async (m) => {
      const war = await this.lockWar(m, warId);
      if (war.status !== 'proposed' && war.status !== 'accepted') {
        throw new ConflictException(
          'A war that has started cannot be withdrawn.',
        );
      }
      const mine = await this.leaderClanOf(m, me.id);
      if (mine.id !== war.challengerClanId) {
        throw new ForbiddenException(
          'Only the clan that made the challenge can withdraw it.',
        );
      }
      await this.voidAndRefund(m, war, 'Withdrawn by the challenging clan.');
    });
    return this.view(await this.load(warId), me);
  }

  /**
   * The game organises a war itself.
   *
   * For events, and — until the player app exists — the only way a war
   * starts at all. It skips the challenge-and-accept step, so it lands
   * straight in `accepted` with the book open and the rake frozen, exactly
   * as an accepted player challenge would. The clans are told; nothing is
   * staked on their behalf, and they are not obliged to play.
   *
   * Recorded as proposed by the challenger's leader, because the column
   * names an enrolment and an admin is not one. The audit log carries who
   * actually pressed the button.
   */
  async organize(input: {
    challengerClanId: string;
    opponentClanId: string;
    startsAt?: string;
  }): Promise<WarView> {
    if (input.challengerClanId === input.opponentClanId) {
      throw new BadRequestException('A clan cannot go to war with itself.');
    }
    const season = await this.seasons.requireCurrent();
    if (season.status !== 'running') {
      throw new ConflictException(
        'Wars can only be fought while the season is running.',
      );
    }
    const startsAt = this.parseStart(input.startsAt);
    const endsAt = new Date(startsAt.getTime() + WAR_DURATION_HOURS * HOUR);

    const warId = await this.dataSource.transaction(async (m) => {
      const clans = await this.lockClans(m, [
        input.challengerClanId,
        input.opponentClanId,
      ]);
      const challenger = clans.find((c) => c.id === input.challengerClanId);
      const opponent = clans.find((c) => c.id === input.opponentClanId);
      if (!challenger || !opponent) {
        throw new NotFoundException('One of those clans does not exist.');
      }
      if (
        challenger.seasonId !== season.id ||
        opponent.seasonId !== season.id
      ) {
        throw new ConflictException('Both clans must be in the live season.');
      }
      if (challenger.status !== 'full' || opponent.status !== 'full') {
        throw new ConflictException('Both clans need a full roster to fight.');
      }
      await this.assertNotAtWar(m, [challenger.id, opponent.id]);

      const leader = await m.findOne(GameClanMember, {
        where: { clanId: challenger.id, role: 'leader' },
      });
      if (!leader) throw new NotFoundException('That clan has no leader.');

      const [row] = returnedRows(
        await m.query(
          `INSERT INTO "game_clan_wars"
             ("seasonId", "challengerClanId", "opponentClanId", "proposedById",
              "status", "startsAt", "endsAt", "acceptedAt", "rakePercent")
           VALUES ($1, $2, $3, $4, 'accepted', $5, $6, now(), $7)
           RETURNING "id"`,
          [
            season.id,
            challenger.id,
            opponent.id,
            leader.enrolmentId,
            startsAt,
            endsAt,
            warRakePercent(this.config),
          ],
        ),
      ) as { id: string }[];
      return row.id;
    });

    const war = await this.load(warId);
    for (const [clanId, other] of [
      [war.challengerClanId, war.opponentClan.name],
      [war.opponentClanId, war.challengerClan.name],
    ] as const) {
      await this.tellClan(
        clanId,
        'The game has set you a war',
        `You face ${other} starting ${this.when(war.startsAt)}, for four hours. Betting is open now.`,
      );
    }
    return this.view(war, null);
  }

  // ===================================================================== book

  /**
   * Put coins on a side.
   *
   * The balance is charged in the same transaction that writes the bet, and
   * the war row is locked first, so the order of events is fixed: the book
   * is either open for this bet or it is not, and the coins either leave
   * with a bet attached or they do not leave at all.
   */
  async placeBet(
    user: User,
    warId: string,
    input: { side: WarSide; coins: number },
  ): Promise<WarView> {
    const me = await this.enrolments.require(user);
    const coins = Math.round(input.coins);
    const max = warMaxStake(this.config);
    if (!Number.isInteger(coins) || coins < WAR_MIN_STAKE_COINS) {
      throw new BadRequestException(
        `A bet is at least ${WAR_MIN_STAKE_COINS} coin.`,
      );
    }

    await this.dataSource.transaction(async (m) => {
      const war = await this.lockWar(m, warId);
      const barred = await this.betBar(m, war, me);
      if (barred) throw new ForbiddenException(barred);

      const existing = await m.findOne(GameWarBet, {
        where: { warId: war.id, enrolmentId: me.id },
      });
      if (existing && existing.side !== input.side) {
        throw new ConflictException(
          `You already backed the ${existing.side === 'challenger' ? 'challenging' : 'challenged'} clan. A bet cannot switch sides.`,
        );
      }
      const after = (existing?.stakeCoins ?? 0) + coins;
      if (after > max) {
        throw new BadRequestException(
          `The most anyone can stake on one war is ${max} coins. You have ${existing?.stakeCoins ?? 0} on it.`,
        );
      }

      // Refuses rather than floors: a stake the balance cannot cover is not
      // a stake. This is the escrow.
      await this.economy.charge(
        me.id,
        coins,
        { reason: 'war_stake', refType: 'war', refId: war.id },
        m,
      );
      await m.query(
        `INSERT INTO "game_war_bets" ("warId", "enrolmentId", "side", "stakeCoins")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("warId", "enrolmentId") DO UPDATE
           SET "stakeCoins" = "game_war_bets"."stakeCoins" + EXCLUDED."stakeCoins",
               "updatedAt" = now()
           WHERE "game_war_bets"."side" = EXCLUDED."side"`,
        [war.id, me.id, input.side, coins],
      );
    });

    return this.view(await this.load(warId), me);
  }

  // =================================================================== reads

  /** Wars worth showing: the open book, what is live, and the recent past. */
  async list(
    user: User | null,
    filter: 'open' | 'live' | 'finished' | 'mine' | 'all' = 'all',
  ): Promise<WarView[]> {
    const season = await this.seasons.current();
    if (!season) return [];
    const me = user ? await this.enrolments.mine(user) : null;

    const statuses: Record<typeof filter, WarStatus[]> = {
      open: ['proposed', 'accepted'],
      live: ['live', 'judging'],
      finished: ['settled', 'void'],
      mine: ['proposed', 'accepted', 'live', 'judging', 'settled', 'void'],
      all: ['proposed', 'accepted', 'live', 'judging', 'settled', 'void'],
    };

    let wars = await this.warRepo.find({
      where: { seasonId: season.id, status: In(statuses[filter]) },
      relations: { challengerClan: true, opponentClan: true },
      order: { startsAt: 'DESC' },
      take: 100,
    });

    if (filter === 'mine') {
      if (!me) return [];
      const betOn = new Set(
        (
          await this.betRepo.find({
            where: { enrolmentId: me.id },
            select: { warId: true },
          })
        ).map((b) => b.warId),
      );
      const clanId = (
        await this.memberRepo.findOne({ where: { enrolmentId: me.id } })
      )?.clanId;
      wars = wars.filter(
        (w) =>
          betOn.has(w.id) ||
          w.challengerClanId === clanId ||
          w.opponentClanId === clanId,
      );
    }

    const enrolment = me ? await this.enrolmentForView(me.id) : null;
    return Promise.all(wars.map((w) => this.view(w, enrolment)));
  }

  async get(user: User | null, warId: string): Promise<WarView> {
    const war = await this.load(warId);
    const mine = user ? await this.enrolments.mine(user) : null;
    return this.view(war, mine ? await this.enrolmentForView(mine.id) : null);
  }

  // ============================================================== the clock

  /**
   * Moves every war along. Idempotent, and safe to run on two instances at
   * once: each transition is a conditional update, and settlement locks.
   */
  async tick(now: Date = new Date()): Promise<TickReport> {
    const report: TickReport = { started: 0, ended: 0, settled: 0, voided: 0 };

    // A challenge nobody answered before it was due to start.
    const stale = await this.warRepo.find({
      where: { status: 'proposed' },
      select: { id: true, startsAt: true },
    });
    for (const w of stale.filter((s) => s.startsAt <= now)) {
      const voided = await this.dataSource.transaction(async (m) => {
        const war = await this.lockWar(m, w.id);
        if (war.status !== 'proposed') return false;
        await this.markVoid(m, war, 'Not accepted before it was due to start.');
        return true;
      });
      if (voided) report.voided += 1;
    }

    report.started = this.affected(
      await this.warRepo.query(
        `UPDATE "game_clan_wars" SET "status" = 'live', "updatedAt" = now()
          WHERE "status" = 'accepted' AND "startsAt" <= $1 RETURNING "id"`,
        [now],
      ),
    );
    report.ended = this.affected(
      await this.warRepo.query(
        `UPDATE "game_clan_wars" SET "status" = 'judging', "updatedAt" = now()
          WHERE "status" = 'live' AND "endsAt" <= $1 RETURNING "id"`,
        [now],
      ),
    );

    const judging = await this.warRepo.find({
      where: { status: 'judging' },
      select: { id: true },
    });
    for (const w of judging) {
      const settled = await this.settle(w.id, { now }).catch((err: unknown) => {
        this.logger.error(
          `Could not settle war ${w.id}`,
          err instanceof Error ? err.stack : String(err),
        );
        return null;
      });
      if (settled?.status === 'settled') report.settled += 1;
    }

    if (Object.values(report).some((n) => n > 0)) {
      this.logger.log(
        `Wars: ${report.started} started, ${report.ended} ended, ${report.settled} settled, ${report.voided} voided`,
      );
    }
    return report;
  }

  /**
   * Every minute. The lock is held for under a minute so a slow run never
   * overlaps the next one on another instance, and a failure is logged
   * rather than thrown: one war that will not settle must not stop the
   * clock for every other.
   */
  @Cron('* * * * *')
  async scheduledTick(): Promise<void> {
    try {
      await this.leaderLock.withLock('gameWars', 55_000, () => this.tick());
    } catch (err) {
      this.logger.error(
        'Clan war tick failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Scores the war and pays the book.
   *
   * Waits while anything handed in during the window is still unjudged —
   * a clan should not lose because its best clip is at the back of the
   * queue. Past the deadline, or with `force`, it settles on what has been
   * decided and says so.
   */
  async settle(
    warId: string,
    options: { force?: boolean; now?: Date } = {},
  ): Promise<GameClanWar> {
    const now = options.now ?? new Date();
    let paid: {
      enrolmentId: string;
      userId: string;
      payout: number;
      stake: number;
    }[] = [];
    let reason = '';

    const done = await this.dataSource.transaction(async (m) => {
      const war = await this.lockWar(m, warId);
      if (war.status === 'settled' || war.status === 'void') return false;
      if (
        war.status !== 'judging' &&
        !(options.force && war.status === 'live')
      ) {
        if (options.force) {
          throw new ConflictException(
            'Only a war that has started can be settled.',
          );
        }
        return false;
      }

      const clans = [war.challengerClanId, war.opponentClanId];
      const pastDeadline =
        now.getTime() - war.endsAt.getTime() >
        WAR_JUDGING_DEADLINE_HOURS * HOUR;
      const pending = await this.pendingInWindow(m, war, clans);
      if (pending > 0 && !pastDeadline && !options.force) return false;

      const scores = await this.scores(m, war, clans);
      const challengerScore = scores.get(war.challengerClanId) ?? 0;
      const opponentScore = scores.get(war.opponentClanId) ?? 0;
      const outcome: WarOutcome =
        challengerScore === opponentScore
          ? 'draw'
          : challengerScore > opponentScore
            ? 'challenger'
            : 'opponent';

      const bets = returnedRows(
        await m.query(
          `SELECT b."id", b."side", b."stakeCoins", b."enrolmentId", e."userId"
             FROM "game_war_bets" b
             JOIN "game_enrolments" e ON e."id" = b."enrolmentId"
            WHERE b."warId" = $1 AND b."settled" = false
            FOR UPDATE OF b`,
          [war.id],
        ),
      ) as {
        id: string;
        side: WarSide;
        stakeCoins: number;
        enrolmentId: string;
        userId: string;
      }[];

      const book = settleWarBook(
        bets.map((b) => ({ betId: b.id, side: b.side, coins: b.stakeCoins })),
        outcome,
        war.rakePercent,
      );
      const byBet = new Map(bets.map((b) => [b.id, b]));
      paid = await this.payOut(m, war.id, book.payouts, byBet, book.refunded);

      await m.query(
        `UPDATE "game_clan_wars"
            SET "status" = 'settled', "settledAt" = now(), "outcome" = $2,
                "winnerClanId" = $3, "challengerScore" = $4, "opponentScore" = $5,
                "settlementReason" = $6, "rakeCoins" = $7, "updatedAt" = now()
          WHERE "id" = $1`,
        [
          war.id,
          outcome,
          outcome === 'challenger'
            ? war.challengerClanId
            : outcome === 'opponent'
              ? war.opponentClanId
              : null,
          challengerScore,
          opponentScore,
          book.reason,
          book.rake,
        ],
      );

      reason =
        pending > 0
          ? ` Settled with ${pending} hand-in(s) still unjudged${options.force ? ' (forced)' : ' after the deadline'}.`
          : '';
      this.logger.log(
        `War ${war.id} settled: ${outcome} ${challengerScore}–${opponentScore}, ${book.reason}, rake ${book.rake}.${reason}`,
      );
      return true;
    });

    const war = await this.load(warId);
    if (done) await this.announceSettlement(war, paid, reason);
    return war;
  }

  /** Calls a war off and gives every stake back. An admin's lever. */
  async voidWar(warId: string, why: string): Promise<GameClanWar> {
    const reason = why.trim().slice(0, 200) || 'Called off by an admin.';
    let refunded: {
      enrolmentId: string;
      userId: string;
      payout: number;
      stake: number;
    }[] = [];
    await this.dataSource.transaction(async (m) => {
      const war = await this.lockWar(m, warId);
      if (war.status === 'settled' || war.status === 'void') {
        throw new ConflictException('That war is already over.');
      }
      refunded = await this.voidAndRefund(m, war, reason);
    });
    const war = await this.load(warId);
    await this.announceVoid(war, refunded);
    return war;
  }

  // ================================================================ helpers

  private parseStart(raw?: string): Date {
    const startsAt = raw ? new Date(raw) : new Date(Date.now() + HOUR);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('That start time is not a date.');
    }
    const lead = startsAt.getTime() - Date.now();
    if (lead < WAR_MIN_LEAD_MINUTES * MINUTE) {
      throw new BadRequestException(
        `A war has to start at least ${WAR_MIN_LEAD_MINUTES} minutes from now, so there is time to bet on it.`,
      );
    }
    if (lead > WAR_MAX_LEAD_DAYS * 24 * HOUR) {
      throw new BadRequestException(
        `A war can be scheduled up to ${WAR_MAX_LEAD_DAYS} days ahead.`,
      );
    }
    return startsAt;
  }

  /** The full clan this enrolment leads, or why it cannot go to war. */
  private async leaderClanOf(
    m: EntityManager,
    enrolmentId: string,
  ): Promise<GameClan> {
    const membership = await m.findOne(GameClanMember, {
      where: { enrolmentId },
    });
    if (!membership) throw new NotFoundException('You are not in a clan.');
    if (membership.role !== 'leader') {
      throw new ForbiddenException(
        'Only a clan leader can take the clan to war.',
      );
    }
    const clan = await m.findOne(GameClan, {
      where: { id: membership.clanId },
    });
    if (!clan) throw new NotFoundException('Clan not found');
    if (clan.status !== 'full') {
      throw new ConflictException(
        'Your clan needs its second member before it can fight.',
      );
    }
    return clan;
  }

  /** Locks clans in id order, so two transactions never deadlock on them. */
  private async lockClans(
    m: EntityManager,
    ids: string[],
  ): Promise<GameClan[]> {
    const sorted = [...new Set(ids)].sort();
    return returnedRows(
      await m.query(
        `SELECT * FROM "game_clans" WHERE "id" = ANY($1::uuid[]) ORDER BY "id" FOR UPDATE`,
        [sorted],
      ),
    ) as GameClan[];
  }

  private async lockWar(m: EntityManager, warId: string): Promise<GameClanWar> {
    const [row] = returnedRows(
      await m.query(
        `SELECT * FROM "game_clan_wars" WHERE "id" = $1 FOR UPDATE`,
        [warId],
      ),
    ) as GameClanWar[];
    if (!row) throw new NotFoundException('War not found');
    return {
      ...row,
      startsAt: new Date(row.startsAt),
      endsAt: new Date(row.endsAt),
    };
  }

  /** A clan is in at most one war that is not over. */
  private async assertNotAtWar(
    m: EntityManager,
    clanIds: string[],
    exceptWarId?: string,
  ): Promise<void> {
    const [row] = returnedRows(
      await m.query(
        `SELECT count(*)::int AS "n" FROM "game_clan_wars"
          WHERE "status" IN ('accepted', 'live', 'judging')
            AND ("challengerClanId" = ANY($1::uuid[]) OR "opponentClanId" = ANY($1::uuid[]))
            AND ($2::uuid IS NULL OR "id" <> $2::uuid)`,
        [clanIds, exceptWarId ?? null],
      ),
    ) as { n: number }[];
    if ((row?.n ?? 0) > 0) {
      throw new ConflictException(
        'One of these clans is already in a war. Finish it first.',
      );
    }
  }

  /**
   * Why this person cannot bet on this war, or null if they can.
   *
   * Asked inside the lock, so the answer holds for the bet that follows.
   */
  private async betBar(
    m: EntityManager,
    war: GameClanWar,
    me: GameEnrolment,
  ): Promise<string | null> {
    if (war.status !== 'accepted' || war.startsAt.getTime() <= Date.now()) {
      return 'The book on this war is closed.';
    }
    if (me.seasonId !== war.seasonId) return 'That war is not in your season.';
    if (me.status === 'cheater') {
      return 'An account flagged for cheating cannot bet.';
    }
    const membership = await m.findOne(GameClanMember, {
      where: { enrolmentId: me.id },
    });
    if (
      membership &&
      (membership.clanId === war.challengerClanId ||
        membership.clanId === war.opponentClanId)
    ) {
      // The one rule that is about the game rather than the book: a player
      // who can back the other side can be paid to lose.
      return 'You are fighting in this war, so you cannot bet on it.';
    }
    return null;
  }

  /** Hand-ins from either clan, inside the window, not yet judged. */
  private async pendingInWindow(
    m: EntityManager,
    war: GameClanWar,
    clanIds: string[],
  ): Promise<number> {
    const [row] = returnedRows(
      await m.query(
        `SELECT count(*)::int AS "n"
           FROM "game_attempts" a
           JOIN "game_clan_members" cm ON cm."enrolmentId" = a."enrolmentId"
          WHERE cm."clanId" = ANY($1::uuid[])
            AND a."status" = 'submitted'
            AND a."submittedAt" >= $2 AND a."submittedAt" < $3`,
        [clanIds, war.startsAt, war.endsAt],
      ),
    ) as { n: number }[];
    return row?.n ?? 0;
  }

  /**
   * Each clan's Nerve from hand-ins *submitted* inside the window.
   *
   * Read from the score ledger, which is the record of every point that
   * moved: rewards add, clawbacks subtract, so a verdict overturned before
   * settlement counts for exactly what it was finally worth. Never below
   * zero.
   */
  private async scores(
    m: EntityManager,
    war: GameClanWar,
    clanIds: string[],
  ): Promise<Map<string, number>> {
    const rows = returnedRows(
      await m.query(
        `SELECT cm."clanId" AS "clanId", GREATEST(COALESCE(SUM(l."delta"), 0), 0)::int AS "score"
           FROM "game_score_ledger" l
           JOIN "game_attempts" a ON a."id" = l."refId"
           JOIN "game_clan_members" cm ON cm."enrolmentId" = l."enrolmentId"
          WHERE l."refType" = 'attempt'
            AND l."reason" IN ('task_reward', 'clawback')
            AND cm."clanId" = ANY($1::uuid[])
            AND a."submittedAt" >= $2 AND a."submittedAt" < $3
          GROUP BY cm."clanId"`,
        [clanIds, war.startsAt, war.endsAt],
      ),
    ) as { clanId: string; score: number }[];
    return new Map(rows.map((r) => [r.clanId, r.score]));
  }

  /** Credits every payout and marks every bet settled, in the caller's tx. */
  private async payOut(
    m: EntityManager,
    warId: string,
    payouts: { betId: string; payout: number }[],
    byBet: Map<
      string,
      { enrolmentId: string; userId: string; stakeCoins: number }
    >,
    refunded: boolean,
  ) {
    const credited: {
      enrolmentId: string;
      userId: string;
      payout: number;
      stake: number;
    }[] = [];
    for (const p of payouts) {
      const bet = byBet.get(p.betId);
      if (!bet) continue;
      if (p.payout > 0) {
        await this.economy.move(
          [bet.enrolmentId],
          {
            coins: p.payout,
            reason: refunded ? 'war_refund' : 'war_payout',
            refType: 'war',
            refId: warId,
          },
          m,
        );
      }
      await m.query(
        `UPDATE "game_war_bets" SET "payoutCoins" = $2, "settled" = true, "updatedAt" = now()
          WHERE "id" = $1`,
        [p.betId, p.payout],
      );
      credited.push({
        enrolmentId: bet.enrolmentId,
        userId: bet.userId,
        payout: p.payout,
        stake: bet.stakeCoins,
      });
    }
    return credited;
  }

  private async voidAndRefund(
    m: EntityManager,
    war: GameClanWar,
    reason: string,
  ) {
    const bets = returnedRows(
      await m.query(
        `SELECT b."id", b."side", b."stakeCoins", b."enrolmentId", e."userId"
           FROM "game_war_bets" b
           JOIN "game_enrolments" e ON e."id" = b."enrolmentId"
          WHERE b."warId" = $1 AND b."settled" = false
          FOR UPDATE OF b`,
        [war.id],
      ),
    ) as {
      id: string;
      side: WarSide;
      stakeCoins: number;
      enrolmentId: string;
      userId: string;
    }[];
    const book = settleWarBook(
      bets.map((b) => ({ betId: b.id, side: b.side, coins: b.stakeCoins })),
      'void',
      0,
    );
    const refunded = await this.payOut(
      m,
      war.id,
      book.payouts,
      new Map(bets.map((b) => [b.id, b])),
      true,
    );
    await this.markVoid(m, war, reason);
    return refunded;
  }

  private async markVoid(m: EntityManager, war: GameClanWar, reason: string) {
    await m.query(
      `UPDATE "game_clan_wars"
          SET "status" = 'void', "outcome" = 'void', "settlementReason" = 'void',
              "voidReason" = $2, "settledAt" = now(), "updatedAt" = now()
        WHERE "id" = $1`,
      [war.id, reason.slice(0, 200)],
    );
  }

  private async load(warId: string): Promise<GameClanWar> {
    const war = await this.warRepo.findOne({
      where: { id: warId },
      relations: { challengerClan: true, opponentClan: true },
    });
    if (!war) throw new NotFoundException('War not found');
    return war;
  }

  private async enrolmentForView(id: string): Promise<GameEnrolment | null> {
    return this.dataSource
      .getRepository(GameEnrolment)
      .findOne({ where: { id } });
  }

  private async view(
    war: GameClanWar,
    reader: Pick<GameEnrolment, 'id' | 'seasonId' | 'status'> | null,
  ): Promise<WarView> {
    const pools = returnedRows(
      await this.betRepo.query(
        `SELECT "side", COALESCE(SUM("stakeCoins"), 0)::int AS "coins", count(*)::int AS "n"
           FROM "game_war_bets" WHERE "warId" = $1 GROUP BY "side"`,
        [war.id],
      ),
    ) as { side: WarSide; coins: number; n: number }[];
    const pool: Record<WarSide, number> = { challenger: 0, opponent: 0 };
    let bettors = 0;
    for (const p of pools) {
      pool[p.side] = p.coins;
      bettors += p.n;
    }

    const startsAt = new Date(war.startsAt);
    const bookOpen =
      war.status === 'accepted' && startsAt.getTime() > Date.now();
    const rake = war.rakePercent || warRakePercent(this.config);
    const returnPerCoin = (side: WarSide): number | null => {
      const win = pool[side];
      const lose = pool[side === 'challenger' ? 'opponent' : 'challenger'];
      if (win === 0 || lose === 0) return null;
      const distributable = lose - Math.floor((lose * rake) / 100);
      return Math.round((1 + distributable / win) * 100) / 100;
    };

    let myBet: WarView['myBet'] = null;
    let canBet: WarView['canBet'] = {
      allowed: false,
      reason: reader ? null : 'Sign in to bet.',
    };
    if (reader) {
      const bet = await this.betRepo.findOne({
        where: { warId: war.id, enrolmentId: reader.id },
      });
      if (bet) {
        myBet = {
          side: bet.side,
          stake: bet.stakeCoins,
          payout: bet.payoutCoins,
          settled: bet.settled,
        };
      }
      const barred = await this.betBar(
        this.dataSource.manager,
        { ...war, startsAt, endsAt: new Date(war.endsAt) },
        reader as GameEnrolment,
      );
      canBet = { allowed: barred === null, reason: barred };
    }

    return {
      id: war.id,
      status: war.status,
      challenger: {
        clanId: war.challengerClanId,
        name: war.challengerClan?.name ?? 'Unknown',
        score: war.challengerScore,
      },
      opponent: {
        clanId: war.opponentClanId,
        name: war.opponentClan?.name ?? 'Unknown',
        score: war.opponentScore,
      },
      startsAt: startsAt.toISOString(),
      endsAt: new Date(war.endsAt).toISOString(),
      bookOpen,
      pools: pool,
      bettors,
      returnPerCoin: {
        challenger: returnPerCoin('challenger'),
        opponent: returnPerCoin('opponent'),
      },
      rakePercent: rake,
      outcome: war.outcome,
      winnerClanId: war.winnerClanId,
      settlementReason: war.settlementReason,
      voidReason: war.voidReason,
      settledAt: war.settledAt ? new Date(war.settledAt).toISOString() : null,
      myBet,
      canBet,
    };
  }

  private affected(result: unknown): number {
    return returnedRows(result).length;
  }

  private when(date: Date): string {
    return new Date(date).toLocaleString('en-GB', {
      timeZone: 'Asia/Tbilisi',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private async tellClan(clanId: string, title: string, body: string) {
    const members = await this.memberRepo.find({
      where: { clanId },
      relations: { enrolment: true },
    });
    for (const member of members) {
      await this.notify(member.enrolment.userId, title, body);
    }
  }

  private async notify(userId: string, title: string, body: string) {
    try {
      await this.notifications.notify(userId, 'system', title, body);
    } catch (err) {
      this.logger.warn(
        `Could not notify ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async announceSettlement(
    war: GameClanWar,
    paid: { userId: string; payout: number; stake: number }[],
    note: string,
  ) {
    const score = `${war.challengerClan.name} ${war.challengerScore} – ${war.opponentScore} ${war.opponentClan.name}`;
    const headline =
      war.outcome === 'draw'
        ? `A draw: ${score}.`
        : `${war.outcome === 'challenger' ? war.challengerClan.name : war.opponentClan.name} won, ${score}.`;

    for (const clanId of [war.challengerClanId, war.opponentClanId]) {
      await this.tellClan(clanId, 'The war is over', `${headline}${note}`);
    }
    for (const p of paid) {
      const body =
        war.settlementReason !== 'paid'
          ? `${headline} Your ${p.stake} coin(s) came back — ${this.refundWords(war.settlementReason)}.`
          : p.payout > 0
            ? `${headline} Your ${p.stake}-coin bet paid ${p.payout}.`
            : `${headline} Your ${p.stake}-coin bet lost.`;
      await this.notify(p.userId, 'Your bet', body);
    }
  }

  private async announceVoid(
    war: GameClanWar,
    refunded: { userId: string; stake: number }[],
  ) {
    for (const clanId of [war.challengerClanId, war.opponentClanId]) {
      await this.tellClan(
        clanId,
        'The war was called off',
        war.voidReason ?? '',
      );
    }
    for (const r of refunded) {
      await this.notify(
        r.userId,
        'Your bet was refunded',
        `${war.voidReason ?? 'The war was called off.'} Your ${r.stake} coin(s) came back.`,
      );
    }
  }

  private refundWords(reason: string | null): string {
    switch (reason) {
      case 'draw':
        return 'the war was a draw';
      case 'one_sided':
        return 'nobody backed the other side, so there was nothing to win';
      default:
        return 'the war did not settle normally';
    }
  }
}
