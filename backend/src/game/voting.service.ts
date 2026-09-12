import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LeaderLockService } from '../common/redis/leader-lock.service';
import { returnedRows, rowsAffected } from '../common/utils/returned-rows';
import { User } from '../users/user.entity';
import { VoteResolverService } from './ai/vote-resolver.service';
import {
  GameAttemptVote,
  type VoteValue,
} from './entities/game-attempt-vote.entity';
import { GameAttempt } from './entities/game-attempt.entity';
import { GameTaskTemplate } from './entities/game-task-template.entity';
import { EnrolmentsService } from './enrolments.service';
import { VOTE_WIN_COOLDOWN_HOURS } from './rules';
import { SeasonsService } from './seasons.service';
import { VerdictsService } from './verdicts.service';

export interface VotableItem {
  id: string;
  day: number;
  kind: string;
  mediaUrl: string | null;
  caption: string | null;
  player: { handle: string };
  task: { title: string; brief: string; proof: string } | null;
  votingEndsAt: string;
  secondsLeft: number;
  yes: number;
  no: number;
  myVote: VoteValue | null;
}

export interface VoteOutcome {
  attemptId: string;
  vote: VoteValue;
  yes: number;
  no: number;
  /** Seconds until this watcher can earn from a vote again; 0 if now. */
  cooldownSecondsLeft: number;
}

/**
 * The watchers' vote.
 *
 * A confirmed hand-in is open for three hours. Watchers — and only
 * watchers, this is how the audience earns — say done or not, one vote
 * each, changeable until the window shuts. Then the resolver looks at the
 * photo, the task and the tallies and settles the attempt through
 * `VerdictsService`, which pays the task and pays every correct "yes"
 * voter outside their cooldown. A clip, or a photo the resolver cannot
 * call, is deferred to a person and paid when they approve.
 *
 * The vote is evidence, never the verdict: a landslide on a photo that
 * does not show the task pays nobody.
 */
@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(
    @InjectRepository(GameAttempt)
    private readonly attemptRepo: Repository<GameAttempt>,
    @InjectRepository(GameAttemptVote)
    private readonly voteRepo: Repository<GameAttemptVote>,
    @InjectRepository(GameTaskTemplate)
    private readonly templateRepo: Repository<GameTaskTemplate>,
    private readonly seasonsService: SeasonsService,
    private readonly enrolmentsService: EnrolmentsService,
    private readonly resolver: VoteResolverService,
    private readonly verdicts: VerdictsService,
    private readonly leaderLock: LeaderLockService,
  ) {}

  /** What is open for a vote right now, oldest window first. */
  async open(user: User): Promise<VotableItem[]> {
    const enrolment = await this.enrolmentsService.require(user, 'watcher');
    const season = await this.seasonsService.requireCurrent();
    const attempts = await this.attemptRepo.find({
      where: { seasonId: season.id, status: 'submitted', votingStatus: 'open' },
      relations: { enrolment: true, taskTemplate: true },
      order: { votingEndsAt: 'ASC' },
      take: 50,
    });
    const live = attempts.filter(
      (a) => a.votingEndsAt && a.votingEndsAt.getTime() > Date.now(),
    );
    if (live.length === 0) return [];
    const tallies = await this.tallies(live.map((a) => a.id));
    const mine = await this.voteRepo.find({
      where: {
        enrolmentId: enrolment.id,
        attemptId: In(live.map((a) => a.id)),
      },
    });
    const myVotes = new Map(mine.map((v) => [v.attemptId, v.vote]));
    return live.map((a) =>
      this.item(a, tallies.get(a.id), myVotes.get(a.id) ?? null),
    );
  }

  /** Casts or changes a vote. Watchers only, open window only. */
  async vote(
    user: User,
    attemptId: string,
    value: VoteValue,
  ): Promise<VoteOutcome> {
    const enrolment = await this.enrolmentsService.require(user, 'watcher');
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Not found');
    if (
      attempt.status !== 'submitted' ||
      attempt.votingStatus !== 'open' ||
      !attempt.votingEndsAt ||
      attempt.votingEndsAt.getTime() <= Date.now()
    ) {
      throw new ConflictException('Voting on that hand-in is closed.');
    }

    // One row per watcher per attempt; a change of mind updates it. The
    // window is re-checked in the statement so a vote cannot land after the
    // resolver has started.
    const written = rowsAffected(
      await this.voteRepo.query(
        `INSERT INTO "game_attempt_votes" ("attemptId", "enrolmentId", "userId", "vote")
         SELECT $1, $2, $3, $4
          WHERE EXISTS (SELECT 1 FROM "game_attempts"
                         WHERE "id" = $1 AND "votingStatus" = 'open' AND "votingEndsAt" > now())
         ON CONFLICT ("attemptId", "enrolmentId") DO UPDATE
           SET "vote" = EXCLUDED."vote", "updatedAt" = now()
           WHERE "game_attempt_votes"."paidCoins" = 0
         RETURNING "id"`,
        [attempt.id, enrolment.id, user.id, value],
      ),
    );
    if (written === 0) {
      throw new ConflictException('Voting on that hand-in is closed.');
    }

    const tally = (await this.tallies([attempt.id])).get(attempt.id) ?? {
      yes: 0,
      no: 0,
    };
    return {
      attemptId: attempt.id,
      vote: value,
      yes: tally.yes,
      no: tally.no,
      cooldownSecondsLeft: cooldownLeft(enrolment.lastVoteWinAt),
    };
  }

  // ------------------------------------------------------------ resolve --

  /**
   * Settles every vote whose window has closed.
   *
   * Each attempt is claimed with a conditional UPDATE to `resolving` first,
   * so two instances (or a reviewer settling by hand at the same moment)
   * cannot both resolve it. The resolver's `unsure` defers to a person.
   */
  async resolveDue(): Promise<{
    resolved: number;
    deferred: number;
    skipped: number;
  }> {
    const due = returnedRows(
      await this.attemptRepo.query(
        `UPDATE "game_attempts"
            SET "votingStatus" = 'resolving', "updatedAt" = now()
          WHERE "votingStatus" = 'open'
            AND "votingEndsAt" <= now()
            AND "status" = 'submitted'
          RETURNING "id"`,
      ),
    ) as { id: string }[];

    let resolved = 0;
    let deferred = 0;
    let skipped = 0;
    for (const { id } of due) {
      try {
        const outcome = await this.resolveOne(id);
        if (outcome === 'resolved') resolved += 1;
        else if (outcome === 'deferred') deferred += 1;
        else skipped += 1;
      } catch (err) {
        skipped += 1;
        this.logger.error(
          `Could not resolve vote on ${id}`,
          err instanceof Error ? err.stack : String(err),
        );
        // Hand it to a person rather than leave it stuck in `resolving`.
        await this.attemptRepo.update(
          { id, votingStatus: 'resolving' },
          { votingStatus: 'deferred' },
        );
      }
    }
    if (due.length > 0) {
      this.logger.log(
        `Votes: ${resolved} resolved, ${deferred} deferred, ${skipped} skipped`,
      );
    }
    return { resolved, deferred, skipped };
  }

  private async resolveOne(
    attemptId: string,
  ): Promise<'resolved' | 'deferred' | 'skipped'> {
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
    });
    if (!attempt || attempt.status !== 'submitted') return 'skipped';
    const template = attempt.taskTemplateId
      ? await this.templateRepo.findOne({
          where: { id: attempt.taskTemplateId },
        })
      : null;
    const tally = (await this.tallies([attempt.id])).get(attempt.id) ?? {
      yes: 0,
      no: 0,
    };

    const resolution = await this.resolver.resolve({
      attempt,
      template,
      yes: tally.yes,
      no: tally.no,
    });

    if (resolution.outcome === 'unsure') {
      await this.attemptRepo.update(
        { id: attempt.id, votingStatus: 'resolving' },
        {
          votingStatus: 'deferred',
          voting: {
            ...resolution,
            by: 'resolver',
            resolvedAt: new Date().toISOString(),
            yes: tally.yes,
            no: tally.no,
            paid: 0,
            cooling: 0,
          },
        },
      );
      return 'deferred';
    }

    await this.verdicts.settle(attempt.id, {
      verdict: resolution.outcome === 'confirmed' ? 'approve' : 'reject',
      reason:
        resolution.outcome === 'confirmed'
          ? undefined
          : (resolution.reasons[0] ??
            'The vote resolver found the task was not done.'),
      by: 'resolver',
      resolution,
    });
    return 'resolved';
  }

  /** Every five minutes; a window that closed is settled within five. */
  @Cron('*/5 * * * *')
  async sweepVotes(): Promise<void> {
    try {
      await this.leaderLock.withLock('gameVotes', 4 * 60_000, () =>
        this.resolveDue(),
      );
    } catch (err) {
      this.logger.error(
        'gameVotes failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ------------------------------------------------------------ helpers --

  private async tallies(
    attemptIds: string[],
  ): Promise<Map<string, { yes: number; no: number }>> {
    if (attemptIds.length === 0) return new Map();
    const rows = await this.voteRepo
      .createQueryBuilder('v')
      .select('v.attemptId', 'attemptId')
      .addSelect('v.vote', 'vote')
      .addSelect('count(*)::int', 'count')
      .where('v.attemptId IN (:...ids)', { ids: attemptIds })
      .groupBy('v.attemptId')
      .addGroupBy('v.vote')
      .getRawMany<{ attemptId: string; vote: VoteValue; count: number }>();
    const out = new Map<string, { yes: number; no: number }>();
    for (const r of rows) {
      const t = out.get(r.attemptId) ?? { yes: 0, no: 0 };
      t[r.vote] = Number(r.count);
      out.set(r.attemptId, t);
    }
    return out;
  }

  private item(
    a: GameAttempt,
    tally: { yes: number; no: number } | undefined,
    myVote: VoteValue | null,
  ): VotableItem {
    const ends = a.votingEndsAt ? new Date(a.votingEndsAt) : new Date();
    return {
      id: a.id,
      day: a.day,
      kind: a.kind,
      mediaUrl: a.mediaUrl,
      caption: a.caption,
      player: { handle: a.enrolment?.handle ?? 'unknown' },
      task: a.taskTemplate
        ? {
            title: a.taskTemplate.title,
            brief: a.taskTemplate.brief,
            proof: a.taskTemplate.proof,
          }
        : null,
      votingEndsAt: ends.toISOString(),
      secondsLeft: Math.max(
        0,
        Math.round((ends.getTime() - Date.now()) / 1000),
      ),
      yes: tally?.yes ?? 0,
      no: tally?.no ?? 0,
      myVote,
    };
  }
}

/** Seconds of cooldown left after a paid vote; 0 when free to earn. */
export function cooldownLeft(
  lastVoteWinAt: Date | null,
  now: Date = new Date(),
): number {
  if (!lastVoteWinAt) return 0;
  const until =
    new Date(lastVoteWinAt).getTime() + VOTE_WIN_COOLDOWN_HOURS * 3_600_000;
  return Math.max(0, Math.round((until - now.getTime()) / 1000));
}
