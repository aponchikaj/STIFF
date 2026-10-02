import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LeaderLockService } from '../common/redis/leader-lock.service';
import { returnedRows } from '../common/utils/returned-rows';
import { NotificationsService } from '../notifications/notifications.service';
import {
  GameEnrolment,
  type DemotionReason,
} from './entities/game-enrolment.entity';
import { dailyMinimumTasks, GAME_TIMEZONE } from './rules';
import { SeasonsService } from './seasons.service';

/** One enrolment the sweep or a flag moved to watcher. */
export interface Demotion {
  enrolmentId: string;
  userId: string;
  reason: DemotionReason;
}

/** What burning a heart did to one enrolment. */
export interface HeartBurn {
  enrolmentId: string;
  userId: string;
  heartsRemaining: number;
  /** True when that was the last one. */
  demoted: boolean;
}

export interface SweepReport {
  /** The season swept, or null when there was nothing live to sweep. */
  seasonId: string | null;
  /** The Tbilisi day that was judged, for the daily minimum. */
  window: { start: string; end: string } | null;
  demoted: Demotion[];
  skipped?: 'no_season' | 'not_running';
}

/**
 * The four ways a player becomes a watcher, and the one way back.
 *
 * Nothing here is reversible by the person it happens to. The role was chosen
 * once and the game holds them to it; what this service adds is that the
 * game can also *revoke* it — for cheating, for not turning up, or for
 * reaching zero — and that an admin can undo a wrong call from the panel.
 *
 * Every demotion is one statement, with the condition inside it. A sweep that
 * read the field and then wrote it would race the player's next upload; a
 * flag that read the enrolment and then zeroed it would race a second
 * reviewer. `RETURNING` is how the caller learns what actually moved.
 *
 * **The sweeps run nightly, Tbilisi time.** Every `@Cron` fires on every
 * instance, so each is wrapped in the leader lock the shop's jobs already
 * use; without Redis it simply runs, which is right for one process.
 */
@Injectable()
export class DisciplineService {
  private readonly logger = new Logger(DisciplineService.name);

  constructor(
    @InjectRepository(GameEnrolment)
    private readonly enrolmentRepo: Repository<GameEnrolment>,
    private readonly dataSource: DataSource,
    private readonly seasonsService: SeasonsService,
    private readonly notifications: NotificationsService,
    private readonly leaderLock: LeaderLockService,
    private readonly config: ConfigService,
  ) {}

  /** Four unless the environment says otherwise. */
  get dailyMinimum(): number {
    return dailyMinimumTasks(this.config);
  }

  // ------------------------------------------------------------ cheating --

  /**
   * Zeroes an account and marks it a cheater.
   *
   * Nerve to zero, hearts to zero, role to watcher, status to `cheater` — and
   * the attempt that proved it, if named, out of the feed. What was zeroed is
   * kept in `demotionSnapshot` so `reinstate` can put it back.
   *
   * Idempotent in the only way that matters: an account already marked is
   * refused rather than zeroed twice, so a model verdict and a reviewer
   * arriving together cannot both "win" and overwrite the snapshot with zeros.
   */
  async flagCheater(
    enrolmentId: string,
    options: { attemptId?: string; by: string; reason?: string },
  ): Promise<GameEnrolment> {
    const reason = (options.reason ?? 'Flagged for cheating.').slice(0, 500);

    const demoted = await this.dataSource.transaction(async (manager) => {
      const rows = returnedRows(
        await manager.query(
          `UPDATE "game_enrolments"
              SET "role"             = 'watcher',
                  "status"           = 'cheater',
                  "demotionReason"   = 'cheating',
                  "demotedAt"        = now(),
                  "demotionSnapshot" = jsonb_build_object(
                                         'nerve', "nerve",
                                         'heartsRemaining', "heartsRemaining",
                                         'coins', "coins",
                                         'attemptId', $2::text,
                                         'by', $3::text
                                       ),
                  "nerve"            = 0,
                  "heartsRemaining"  = 0,
                  "coins"            = 0,
                  "updatedAt"        = now()
            WHERE "id" = $1 AND "status" <> 'cheater'
            RETURNING "id", "userId",
                      ("demotionSnapshot"->>'coins')::int AS "coinsBefore",
                      ("demotionSnapshot"->>'nerve')::int AS "nerveBefore"`,
          [enrolmentId, options.attemptId ?? null, options.by],
        ),
      ) as {
        id: string;
        userId: string;
        coinsBefore: number | null;
        nerveBefore: number | null;
      }[];

      if (rows.length === 0) {
        const existing = await manager.findOne(GameEnrolment, {
          where: { id: enrolmentId },
        });
        if (!existing) throw new NotFoundException('Enrolment not found');
        throw new ConflictException(
          'That account is already marked as a cheater.',
        );
      }

      // The ledgers record the zeroing, so the coin total and the score stay
      // the sum of their rows even after a punishment.
      const coinsBefore = rows[0].coinsBefore ?? 0;
      if (coinsBefore > 0) {
        await manager.query(
          `INSERT INTO "game_coin_ledger"
             ("enrolmentId", "delta", "balanceAfter", "reason", "refType", "refId")
           VALUES ($1, $2, 0, 'cheating', 'attempt', $3)`,
          [enrolmentId, -coinsBefore, options.attemptId ?? null],
        );
      }
      const nerveBefore = rows[0].nerveBefore ?? 0;
      if (nerveBefore > 0) {
        await manager.query(
          `INSERT INTO "game_score_ledger"
             ("enrolmentId", "delta", "scoreAfter", "reason", "refType", "refId", "by")
           VALUES ($1, $2, 0, 'cheating', 'attempt', $3, $4)`,
          [enrolmentId, -nerveBefore, options.attemptId ?? null, options.by],
        );
      }

      if (options.attemptId) {
        // Only this enrolment's own attempt, and only one that was in play.
        // A wrong id from a caller must not reject somebody else's clip.
        await manager.query(
          `UPDATE "game_attempts"
              SET "status" = 'rejected',
                  "publishedAt" = NULL,
                  "rejectionReason" = $3,
                  "updatedAt" = now()
            WHERE "id" = $1 AND "enrolmentId" = $2
              AND "status" IN ('submitted', 'published')`,
          [options.attemptId, enrolmentId, reason],
        );
      }
      return rows[0];
    });

    this.logger.warn(
      `Enrolment ${enrolmentId} marked as cheater by ${options.by}: ${reason}`,
    );
    await this.tell(
      demoted.userId,
      'You have been removed from the game',
      'Your hand-in was found to be fake or not your own work. Your Nerve and hearts are gone and you can only watch now.',
    );

    return this.fresh(enrolmentId);
  }

  /**
   * Puts a demoted or flagged account back as an active player.
   *
   * Admin only, and the one direction the game itself never takes. With
   * `restore`, the Nerve and hearts recorded at the moment of demotion come
   * back; without it the account returns as a player with whatever it has.
   */
  async reinstate(
    enrolmentId: string,
    options: { restore?: boolean; by: string },
  ): Promise<GameEnrolment> {
    const restore = options.restore ?? true;
    const row = await this.dataSource.transaction(async (manager) => {
      const rows = returnedRows(
        await manager.query(
          `WITH before AS (
             SELECT "id", "coins", "nerve"
               FROM "game_enrolments"
              WHERE "id" = $1
              FOR UPDATE
           )
           UPDATE "game_enrolments" e
              SET "role"             = 'player',
                  "status"           = 'active',
                  "demotionReason"   = NULL,
                  "demotedAt"        = NULL,
                  "nerve"            = CASE WHEN $2 AND e."demotionSnapshot" ? 'nerve'
                                         THEN (e."demotionSnapshot"->>'nerve')::int
                                         ELSE e."nerve" END,
                  "heartsRemaining"  = CASE WHEN $2 AND e."demotionSnapshot" ? 'heartsRemaining'
                                         THEN (e."demotionSnapshot"->>'heartsRemaining')::int
                                         ELSE e."heartsRemaining" END,
                  "coins"            = CASE WHEN $2 AND e."demotionSnapshot" ? 'coins'
                                         THEN (e."demotionSnapshot"->>'coins')::int
                                         ELSE e."coins" END,
                  "demotionSnapshot" = NULL,
                  "updatedAt"        = now()
             FROM before
            WHERE e."id" = before."id" AND e."status" <> 'active'
            RETURNING e."id", e."userId",
                      before."coins" AS "coinsBefore", e."coins",
                      before."nerve" AS "nerveBefore", e."nerve"`,
          [enrolmentId, restore],
        ),
      ) as {
        id: string;
        userId: string;
        coinsBefore: number;
        coins: number;
        nerveBefore: number;
        nerve: number;
      }[];

      if (rows.length === 0) {
        const existing = await manager.findOne(GameEnrolment, {
          where: { id: enrolmentId },
        });
        if (!existing) throw new NotFoundException('Enrolment not found');
        throw new ConflictException(
          'That account is already an active player.',
        );
      }

      // What came back is written down like what went — and only what came
      // back. A player demoted for hearts kept their coins and Nerve, so
      // their reinstatement moves nothing and records nothing.
      const [r] = rows;
      const coinsDelta = r.coins - r.coinsBefore;
      if (coinsDelta !== 0) {
        await manager.query(
          `INSERT INTO "game_coin_ledger"
             ("enrolmentId", "delta", "balanceAfter", "reason", "refType", "refId")
           VALUES ($1, $2, $3, 'reinstated', 'admin', NULL)`,
          [enrolmentId, coinsDelta, r.coins],
        );
      }
      const nerveDelta = r.nerve - r.nerveBefore;
      if (nerveDelta !== 0) {
        await manager.query(
          `INSERT INTO "game_score_ledger"
             ("enrolmentId", "delta", "scoreAfter", "reason", "refType", "refId", "by")
           VALUES ($1, $2, $3, 'reinstated', 'admin', NULL, $4)`,
          [enrolmentId, nerveDelta, r.nerve, options.by],
        );
      }
      return r;
    });

    this.logger.log(`Enrolment ${enrolmentId} reinstated by ${options.by}`);
    await this.tell(
      row.userId,
      'You are back in the game',
      'A reviewer looked again and put you back as a player.',
    );
    return this.fresh(enrolmentId);
  }

  // -------------------------------------------------------------- hearts --

  /**
   * Burns one heart on each enrolment, and demotes any that now have none.
   *
   * Never below zero, and never returned — spec §12, ash is permanent. The
   * floor is in the statement rather than in a later correction. Called for
   * a declined task and for a clock that reached 00:00; the caller has
   * already recorded which.
   */
  async burnHearts(
    enrolmentIds: string[],
    cause: 'declined' | 'expired',
  ): Promise<HeartBurn[]> {
    const ids = [...new Set(enrolmentIds)];
    if (ids.length === 0) return [];

    const rows = returnedRows(
      await this.enrolmentRepo.query(
        `UPDATE "game_enrolments"
            SET "heartsRemaining" = GREATEST("heartsRemaining" - 1, 0),
                "updatedAt" = now()
          WHERE "id" = ANY($1::uuid[]) AND "role" = 'player'
          RETURNING "id", "userId", "heartsRemaining"`,
        [ids],
      ),
    ) as { id: string; userId: string; heartsRemaining: number }[];

    const demoted = await this.demoteOutOfHearts(
      rows.filter((r) => r.heartsRemaining <= 0).map((r) => r.id),
    );
    const out = new Set(demoted.map((d) => d.enrolmentId));

    for (const row of rows) {
      if (out.has(row.id)) continue;
      await this.tell(
        row.userId,
        'You lost a heart',
        cause === 'declined'
          ? `Declining a task costs a heart. You have ${row.heartsRemaining} left.`
          : `The clock ran out before you handed in. You have ${row.heartsRemaining} left.`,
      );
    }

    return rows.map((row) => ({
      enrolmentId: row.id,
      userId: row.userId,
      heartsRemaining: row.heartsRemaining,
      demoted: out.has(row.id),
    }));
  }

  /**
   * Any of these players with no hearts left becomes a watcher.
   *
   * Conditional on the row rather than on what the caller believes: an admin
   * verdict and a clock expiry can both burn the last heart within the same
   * second, and only one of them should be the one that demotes.
   */
  async demoteOutOfHearts(enrolmentIds: string[]): Promise<Demotion[]> {
    const ids = [...new Set(enrolmentIds)];
    if (ids.length === 0) return [];

    const rows = returnedRows(
      await this.enrolmentRepo.query(
        `UPDATE "game_enrolments"
            SET "role"             = 'watcher',
                "status"           = 'demoted',
                "demotionReason"   = 'out_of_hearts',
                "demotedAt"        = now(),
                "demotionSnapshot" = jsonb_build_object(
                                       'nerve', "nerve",
                                       'heartsRemaining', 0,
                                       'by', 'hearts'
                                     ),
                "updatedAt"        = now()
          WHERE "id" = ANY($1::uuid[])
            AND "role" = 'player'
            AND "status" = 'active'
            AND "heartsRemaining" <= 0
          RETURNING "id", "userId"`,
        [ids],
      ),
    ) as { id: string; userId: string }[];

    const demoted = rows.map((row) => ({
      enrolmentId: row.id,
      userId: row.userId,
      reason: 'out_of_hearts' as const,
    }));
    for (const row of demoted) {
      await this.tell(
        row.userId,
        'You are a watcher now',
        'You lost your last heart. You can watch the rest of the season, but you cannot play.',
      );
    }
    if (demoted.length > 0) {
      this.logger.log(
        `Out of hearts: ${demoted.length} player(s) moved to watcher`,
      );
    }
    return demoted;
  }

  // -------------------------------------------------------------- sweeps --

  /**
   * Every player who handed in fewer than the minimum yesterday becomes a
   * watcher.
   *
   * "Yesterday" is the last whole Tbilisi day before `now`. Only players who
   * were enrolled before that day began are judged — someone who joined at
   * 23:50 has not had a day — and only when the season was running for the
   * whole of it. An attempt counts once its upload is confirmed
   * (`submittedAt`) and is not rejected; one still waiting for a verdict
   * counts, because a slow review queue is not the player's fault.
   */
  async sweepDailyMinimum(now: Date = new Date()): Promise<SweepReport> {
    const season = await this.seasonsService.current();
    if (!season) {
      return {
        seasonId: null,
        window: null,
        demoted: [],
        skipped: 'no_season',
      };
    }
    const window = await this.yesterday(now);
    if (
      season.status !== 'running' ||
      !season.startsAt ||
      new Date(season.startsAt) > new Date(window.start)
    ) {
      return {
        seasonId: season.id,
        window,
        demoted: [],
        skipped: 'not_running',
      };
    }

    const minimum = this.dailyMinimum;
    const rows = returnedRows(
      await this.enrolmentRepo.query(
        `WITH short AS (
           SELECT e."id"
             FROM "game_enrolments" e
            WHERE e."seasonId" = $1
              AND e."role" = 'player'
              AND e."status" = 'active'
              AND e."createdAt" < $2::timestamptz
              AND (SELECT count(*)
                     FROM "game_attempts" a
                    WHERE a."enrolmentId" = e."id"
                      AND a."status" IN ('submitted', 'published')
                      AND a."submittedAt" >= $2::timestamptz
                      AND a."submittedAt" <  $3::timestamptz) < $4
         )
         UPDATE "game_enrolments" e
            SET "role"             = 'watcher',
                "status"           = 'demoted',
                "demotionReason"   = 'missed_daily_minimum',
                "demotedAt"        = now(),
                "demotionSnapshot" = jsonb_build_object(
                                       'nerve', e."nerve",
                                       'heartsRemaining', e."heartsRemaining",
                                       'by', 'sweep'
                                     ),
                "updatedAt"        = now()
           FROM short
          WHERE e."id" = short."id"
          RETURNING e."id", e."userId"`,
        [season.id, window.start, window.end, minimum],
      ),
    ) as { id: string; userId: string }[];

    const demoted = rows.map((row) => ({
      enrolmentId: row.id,
      userId: row.userId,
      reason: 'missed_daily_minimum' as const,
    }));
    for (const row of demoted) {
      await this.tell(
        row.userId,
        'You are a watcher now',
        `You handed in fewer than ${minimum} tasks yesterday. Players must hand in at least ${minimum} every day.`,
      );
    }
    if (demoted.length > 0) {
      this.logger.log(
        `Daily minimum: ${demoted.length} player(s) moved to watcher for ${window.start.slice(0, 10)}`,
      );
    }
    return { seasonId: season.id, window, demoted };
  }

  /**
   * Every player on zero of everything becomes a watcher.
   *
   * Zero Nerve, zero hearts, zero coins. A player starts with hearts, so this never
   * catches someone who has only just joined; it catches someone whose stake
   * is gone and who has scored nothing.
   */
  async sweepZeroBalance(): Promise<SweepReport> {
    const season = await this.seasonsService.current();
    if (!season) {
      return {
        seasonId: null,
        window: null,
        demoted: [],
        skipped: 'no_season',
      };
    }

    const rows = returnedRows(
      await this.enrolmentRepo.query(
        `UPDATE "game_enrolments"
            SET "role"             = 'watcher',
                "status"           = 'demoted',
                "demotionReason"   = 'zero_balance',
                "demotedAt"        = now(),
                "demotionSnapshot" = jsonb_build_object(
                                       'nerve', 0, 'heartsRemaining', 0, 'by', 'sweep'
                                     ),
                "updatedAt"        = now()
          WHERE "seasonId" = $1
            AND "role" = 'player'
            AND "status" = 'active'
            AND "nerve" = 0
            AND "heartsRemaining" = 0
            AND "coins" = 0
          RETURNING "id", "userId"`,
        [season.id],
      ),
    ) as { id: string; userId: string }[];

    const demoted = rows.map((row) => ({
      enrolmentId: row.id,
      userId: row.userId,
      reason: 'zero_balance' as const,
    }));
    for (const row of demoted) {
      await this.tell(
        row.userId,
        'You are a watcher now',
        'You reached zero Nerve, zero coins and no hearts, so you are out of the ladder.',
      );
    }
    if (demoted.length > 0) {
      this.logger.log(
        `Zero balance: ${demoted.length} player(s) moved to watcher`,
      );
    }
    return { seasonId: season.id, window: null, demoted };
  }

  /** Both sweeps, in order. What the panel's button and the crons call. */
  async runSweeps(now: Date = new Date()): Promise<{
    dailyMinimum: SweepReport;
    zeroBalance: SweepReport;
  }> {
    const dailyMinimum = await this.sweepDailyMinimum(now);
    const zeroBalance = await this.sweepZeroBalance();
    return { dailyMinimum, zeroBalance };
  }

  /** Five past midnight in Tbilisi: judge yesterday. */
  @Cron('5 0 * * *', { timeZone: GAME_TIMEZONE })
  async nightlyDailyMinimum(): Promise<void> {
    await this.scheduled('gameDailyMinimum', () => this.sweepDailyMinimum());
  }

  /** Ten past: anyone on zero of everything. */
  @Cron('10 0 * * *', { timeZone: GAME_TIMEZONE })
  async nightlyZeroBalance(): Promise<void> {
    await this.scheduled('gameZeroBalance', () => this.sweepZeroBalance());
  }

  // ------------------------------------------------------------- helpers --

  /**
   * The last whole day before `now`, in the game's time zone, as UTC bounds.
   *
   * Asked of Postgres rather than computed here: `AT TIME ZONE` knows about
   * Tbilisi's offset history and Node's `Date` does not, and the same
   * expression is what the sweep's `WHERE` would otherwise have to repeat.
   */
  private async yesterday(now: Date): Promise<{ start: string; end: string }> {
    const rows = returnedRows(
      await this.enrolmentRepo.query(
        `SELECT (date_trunc('day', ($1::timestamptz) AT TIME ZONE $2) - interval '1 day')
                  AT TIME ZONE $2 AS "start",
                date_trunc('day', ($1::timestamptz) AT TIME ZONE $2)
                  AT TIME ZONE $2 AS "end"`,
        [now.toISOString(), GAME_TIMEZONE],
      ),
    ) as { start: Date | string; end: Date | string }[];
    const row = rows[0];
    return {
      start: new Date(row.start).toISOString(),
      end: new Date(row.end).toISOString(),
    };
  }

  private async scheduled(
    name: string,
    job: () => Promise<SweepReport>,
  ): Promise<void> {
    try {
      await this.leaderLock.withLock(name, 10 * 60_000, job);
    } catch (err) {
      this.logger.error(
        `${name} failed`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /** A notification that fails must not fail the demotion it describes. */
  private async tell(
    userId: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      await this.notifications.notify(userId, 'system', title, body);
    } catch (err) {
      this.logger.warn(
        `Could not notify ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async fresh(enrolmentId: string): Promise<GameEnrolment> {
    const row = await this.enrolmentRepo.findOne({
      where: { id: enrolmentId },
    });
    if (!row) throw new NotFoundException('Enrolment not found');
    return row;
  }
}
