import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { returnedRows, rowsAffected } from '../common/utils/returned-rows';
import { ClansService } from './clans.service';
import { DisciplineService } from './discipline.service';
import { EconomyService, type CoinMovement } from './economy.service';
import {
  GameAttempt,
  type VotingResolution,
} from './entities/game-attempt.entity';
import { GameTaskAssignment } from './entities/game-task-assignment.entity';
import {
  clampPenalty,
  clampVoteReward,
  defaultVoteReward,
  VOTE_WIN_COOLDOWN_HOURS,
} from './rules';

export type Verdict = 'approve' | 'reject';

export interface SettleOptions {
  verdict: Verdict;
  /** Nerve to award. Only read on an approval. */
  nerve?: number;
  /** Spec §12 — ash never returns, so this is deliberate and one-way. */
  burnHeart?: boolean;
  reason?: string;
  /** Who decided: an admin's id, or `resolver` for the vote resolver. */
  by?: string;
  /** The resolver's conclusion, when it is the one settling. */
  resolution?: Pick<
    VotingResolution,
    'outcome' | 'confidence' | 'payout' | 'reasons' | 'model'
  >;
}

/**
 * The verdict on a hand-in, and everything it sets in motion.
 *
 * Extracted from the admin service because two things now settle an
 * attempt: a person in the panel, and the vote resolver when the watchers'
 * window closes. Both come through here so there is one implementation of
 * "publish an attempt, pay the task, pay the voters" rather than two that
 * drift.
 *
 * The transition is claimed with a conditional UPDATE rather than read then
 * written, so two settlers cannot both award its rewards — the score ranks
 * the season, so paying it twice is not a cosmetic bug.
 */
@Injectable()
export class VerdictsService {
  private readonly logger = new Logger(VerdictsService.name);

  constructor(
    @InjectRepository(GameAttempt)
    private readonly attemptRepo: Repository<GameAttempt>,
    private readonly dataSource: DataSource,
    private readonly discipline: DisciplineService,
    private readonly economy: EconomyService,
    private readonly clans: ClansService,
  ) {}

  /**
   * The verdict. This is the only thing that puts an attempt in the feed.
   *
   * The transition is claimed with a conditional UPDATE rather than read then
   * written, so two reviewers opening the same item cannot both settle it —
   * and, more to the point, cannot both award its Nerve. The score is what
   * ranks the season, so paying it twice is not a cosmetic bug.
   *
   * Idempotent by construction: a second call finds a status that is no longer
   * `submitted` and is told so.
   */
  async settle(
    attemptId: string,
    options: SettleOptions,
  ): Promise<GameAttempt> {
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status === 'awaiting_upload') {
      throw new BadRequestException('Nothing has been uploaded for that day.');
    }

    const nerve = Math.max(0, Math.round(options.nerve ?? 0));
    const approving = options.verdict === 'approve';

    await this.dataSource.transaction(async (manager) => {
      const claimed = rowsAffected(
        await manager.query<unknown[]>(
          `UPDATE "game_attempts"
              SET "status" = $2,
                  "publishedAt" = CASE WHEN $2 = 'published' THEN now() ELSE NULL END,
                  "rejectionReason" = CASE WHEN $2 = 'rejected' THEN $3 ELSE NULL END
            WHERE "id" = $1 AND "status" = 'submitted'
            RETURNING "id"`,
          [
            attemptId,
            approving ? 'published' : 'rejected',
            approving ? null : options.reason?.trim().slice(0, 500) || null,
          ],
        ),
      );
      if (claimed === 0) {
        throw new ConflictException('That attempt has already been settled.');
      }

      // The vote, if one was open or waiting on a person, closes with this
      // verdict — and a yes-voter is paid only when the verdict is yes.
      await this.closeVoting(manager, attempt, approving, options);

      // What the task pays, and to whom. A solo attempt pays its holder: the
      // reviewer's `nerve` if given, else the template's reward, plus the
      // template's coins. A clan attempt pays both members the template's
      // reward, and a rejection charges both the template's penalty — one to
      // three coins. All through the ledger, in this transaction.
      const assignment = attempt.assignmentId
        ? await manager.findOne(GameTaskAssignment, {
            where: { id: attempt.assignmentId },
            relations: { taskTemplate: true },
          })
        : null;
      const template = assignment?.taskTemplate ?? null;
      const payees = assignment?.clanId
        ? await this.clans.memberEnrolmentIds(assignment.clanId)
        : [attempt.enrolmentId];

      if (approving) {
        const paidNerve = assignment?.clanId
          ? (template?.rewardNerve ?? 0)
          : options.nerve !== undefined
            ? nerve
            : (template?.rewardNerve ?? 0);
        const paidCoins = template?.rewardCoins ?? 0;
        const moved = await this.economy.move(
          payees,
          {
            coins: paidCoins,
            nerve: paidNerve,
            reason: 'task_reward',
            refType: 'attempt',
            refId: attemptId,
            by: options.by,
          },
          manager,
        );
        if (moved.length > 0 && (paidNerve > 0 || paidCoins > 0)) {
          await this.economy.announce(
            moved,
            assignment?.clanId ? 'Your clan finished a task' : 'Task approved',
            (m) =>
              `+${m.nerveDelta} Nerve, +${m.coinsDelta} coin(s). You have ${m.coinsAfter} coin(s).`,
          );
        }
      } else if (assignment?.clanId) {
        const penalty = clampPenalty(template?.penaltyCoins);
        const moved = await this.economy.move(
          payees,
          {
            coins: -penalty,
            reason: 'task_penalty',
            refType: 'attempt',
            refId: attemptId,
            by: options.by,
          },
          manager,
        );
        await this.economy.announce(
          moved,
          'Your clan failed a task',
          (m) =>
            `The hand-in was rejected. ${-m.coinsDelta} coin(s) taken; you have ${m.coinsAfter}.`,
        );
      }

      if (options.burnHeart) {
        // Never below zero, and never returned. Spec §12: ash is permanent,
        // so the floor is in the statement rather than in a later correction.
        await manager.query(
          `UPDATE "game_enrolments"
              SET "heartsRemaining" = GREATEST("heartsRemaining" - 1, 0)
            WHERE "id" = $1`,
          [attempt.enrolmentId],
        );
      }
    });

    // A burned last heart ends the season for them, whoever burned it.
    if (options.burnHeart) {
      await this.discipline.demoteOutOfHearts([attempt.enrolmentId]);
    }

    const settled = await this.attemptRepo.findOne({
      where: { id: attemptId },
    });
    return settled ?? attempt;
  }

  /**
   * Settles the watchers' vote with the verdict.
   *
   * Every correct "yes" voter outside their cooldown is paid the payout —
   * the resolver's figure when it decided, the tier's default when a person
   * did — and starts a new cooldown. A "no" earns nothing whatever the
   * outcome, by the rule as written. Everything is one statement per step
   * so a voter cannot be paid twice by two settlers racing.
   */
  private async closeVoting(
    manager: EntityManager,
    attempt: GameAttempt,
    approving: boolean,
    options: SettleOptions,
  ): Promise<void> {
    if (
      attempt.votingStatus !== 'open' &&
      attempt.votingStatus !== 'resolving' &&
      attempt.votingStatus !== 'deferred'
    ) {
      return;
    }

    const tallies = returnedRows(
      await manager.query(
        `SELECT "vote", count(*)::int AS "count"
           FROM "game_attempt_votes" WHERE "attemptId" = $1 GROUP BY "vote"`,
        [attempt.id],
      ),
    ) as { vote: 'yes' | 'no'; count: number }[];
    const yes = tallies.find((t) => t.vote === 'yes')?.count ?? 0;
    const no = tallies.find((t) => t.vote === 'no')?.count ?? 0;

    const payout = clampVoteReward(
      options.resolution?.payout ?? defaultVoteReward(attempt.day),
    );

    let paid = 0;
    let cooling = 0;
    if (approving && yes > 0) {
      // One statement: every yes-voter whose cooldown has passed gets the
      // coins and a fresh cooldown; the rest are counted, not paid.
      const winners = returnedRows(
        await manager.query(
          `WITH eligible AS (
             SELECT v."id" AS "voteId", e."id" AS "enrolmentId"
               FROM "game_attempt_votes" v
               JOIN "game_enrolments" e ON e."id" = v."enrolmentId"
              WHERE v."attemptId" = $1 AND v."vote" = 'yes' AND v."paidCoins" = 0
                AND (e."lastVoteWinAt" IS NULL
                     OR e."lastVoteWinAt" <= now() - make_interval(hours => $3))
              FOR UPDATE OF e
           ),
           won AS (
             UPDATE "game_enrolments" e
                SET "coins" = e."coins" + $2,
                    "lastVoteWinAt" = now(),
                    "updatedAt" = now()
               FROM eligible
              WHERE e."id" = eligible."enrolmentId"
              RETURNING e."id", e."coins", eligible."voteId"
           ),
           marked AS (
             UPDATE "game_attempt_votes" v
                SET "paidCoins" = $2, "updatedAt" = now()
               FROM won WHERE v."id" = won."voteId"
              RETURNING v."id"
           )
           INSERT INTO "game_coin_ledger"
             ("enrolmentId", "delta", "balanceAfter", "reason", "refType", "refId")
           SELECT won."id", $2, won."coins", 'vote_reward', 'attempt', $1
             FROM won
           RETURNING "enrolmentId"`,
          [attempt.id, payout, VOTE_WIN_COOLDOWN_HOURS],
        ),
      ) as { enrolmentId: string }[];
      paid = winners.length;
      cooling = Math.max(0, yes - paid);
    }

    const resolution: VotingResolution = {
      outcome:
        options.resolution?.outcome ??
        (approving ? 'confirmed' : 'not_confirmed'),
      confidence: options.resolution?.confidence ?? 1,
      payout,
      reasons: options.resolution?.reasons ?? [
        approving ? 'Approved by a reviewer.' : 'Rejected by a reviewer.',
      ],
      model: options.resolution?.model ?? null,
      by: options.by ?? 'admin',
      resolvedAt: new Date().toISOString(),
      yes,
      no,
      paid,
      cooling,
    };
    await manager.query(
      `UPDATE "game_attempts"
          SET "votingStatus" = 'resolved', "voting" = $2::jsonb, "updatedAt" = now()
        WHERE "id" = $1`,
      [attempt.id, JSON.stringify(resolution)],
    );
    if (paid > 0) {
      this.logger.log(
        `Vote on ${attempt.id}: ${yes} yes / ${no} no, ${paid} paid ${payout} coin(s), ${cooling} cooling`,
      );
    }
  }

  /**
   * Takes a published item back out of the feed, and its Nerve back off the
   * board.
   *
   * The score is clawed back through the ledger, not subtracted: for every
   * enrolment the attempt paid, the net of what it was paid and anything
   * already taken back is read from `game_score_ledger` and moved as a
   * `clawback` row against the same attempt. So an overturned verdict leaves
   * a record of why the board changed, a second call finds nothing left to
   * take, and a clan attempt takes it back from both members. Coins are
   * left where they are — a coin may already be spent, and the rule as
   * written claws back the score.
   *
   * Idempotent on the transition: an attempt that is not in the feed is
   * refused, so two admins cannot both "win" and claw back twice.
   */
  async unpublish(
    attemptId: string,
    options: { by?: string } = {},
  ): Promise<GameAttempt> {
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    const clawed = await this.dataSource.transaction(async (manager) => {
      const claimed = rowsAffected(
        await manager.query(
          `UPDATE "game_attempts"
              SET "status" = 'rejected', "publishedAt" = NULL, "updatedAt" = now()
            WHERE "id" = $1 AND "status" = 'published'
            RETURNING "id"`,
          [attemptId],
        ),
      );
      if (claimed === 0) {
        throw new ConflictException('That attempt is not in the feed.');
      }

      const paid = returnedRows(
        await manager.query(
          `SELECT "enrolmentId", SUM("delta")::int AS "net"
             FROM "game_score_ledger"
            WHERE "refType" = 'attempt' AND "refId" = $1
              AND "reason" IN ('task_reward', 'clawback')
            GROUP BY "enrolmentId"
           HAVING SUM("delta") > 0`,
          [attemptId],
        ),
      ) as { enrolmentId: string; net: number }[];

      const moved: CoinMovement[] = [];
      for (const row of paid) {
        moved.push(
          ...(await this.economy.move(
            [row.enrolmentId],
            {
              coins: 0,
              nerve: -row.net,
              reason: 'admin',
              scoreReason: 'clawback',
              refType: 'attempt',
              refId: attemptId,
              by: options.by ?? 'admin',
            },
            manager,
          )),
        );
      }
      return moved;
    });

    if (clawed.some((m) => m.nerveDelta !== 0)) {
      await this.economy.announce(
        clawed.filter((m) => m.nerveDelta !== 0),
        'A hand-in was taken back',
        (m) =>
          `A reviewer took a published hand-in out of the feed. ${-m.nerveDelta} Nerve taken back; you have ${m.nerveAfter}.`,
      );
      this.logger.log(
        `Unpublished ${attemptId}: clawed back Nerve from ${clawed.length} enrolment(s)`,
      );
    }

    const fresh = await this.attemptRepo.findOne({ where: { id: attemptId } });
    return fresh ?? attempt;
  }
}
