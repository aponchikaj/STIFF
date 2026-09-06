import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { rowsAffected } from '../common/utils/returned-rows';
import { GameAttempt } from './entities/game-attempt.entity';
import { GameSeason, type SeasonStatus } from './entities/game-season.entity';

export type Verdict = 'approve' | 'reject';

export interface SettleOptions {
  verdict: Verdict;
  /** Nerve to award. Only read on an approval. */
  nerve?: number;
  /** Spec §12 — ash never returns, so this is deliberate and one-way. */
  burnHeart?: boolean;
  reason?: string;
}

/**
 * What operating a season actually takes.
 *
 * These are the routes behind the control room. They live here rather than in
 * `src/admin/` for the same reason the Products and Orders tabs do: the panel
 * edits the game through the game's own controllers under `@Roles('admin')`,
 * so there is one implementation of "publish an attempt" rather than two that
 * drift. `src/admin/` holds only what the separate origin needs.
 *
 * Nothing here is a nicety. Without it there is no season to enrol into and no
 * way for an attempt to reach the feed, which makes every route in
 * `GameController` a read of an empty table.
 */
@Injectable()
export class GameAdminService {
  constructor(
    @InjectRepository(GameSeason)
    private readonly seasonRepo: Repository<GameSeason>,
    @InjectRepository(GameAttempt)
    private readonly attemptRepo: Repository<GameAttempt>,
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------- seasons --

  listSeasons(): Promise<GameSeason[]> {
    return this.seasonRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createSeason(input: {
    slug: string;
    title: string;
    startingHearts?: number;
  }): Promise<GameSeason> {
    const slug = input.slug.trim().toLowerCase();
    const clash = await this.seasonRepo.findOne({ where: { slug } });
    if (clash) throw new ConflictException('A season already has that slug.');

    return this.seasonRepo.save(
      this.seasonRepo.create({
        slug,
        title: input.title.trim(),
        // Draft, always. A season that went live the moment it was named
        // would open enrolment before anyone had written the tasks.
        status: 'draft',
        startingHearts: input.startingHearts ?? 3,
      }),
    );
  }

  /**
   * Moves a season along: draft → open → running → closed.
   *
   * **Only one season may be live at a time.** `SeasonsService.current()`
   * answers with the newest open-or-running row, so a second live season would
   * silently take over the front door and strand everyone enrolled in the
   * first. Refusing is the only honest answer, and it names the season in the
   * way rather than leaving the operator to guess.
   */
  async setSeasonStatus(id: string, status: SeasonStatus): Promise<GameSeason> {
    const season = await this.seasonRepo.findOne({ where: { id } });
    if (!season) throw new NotFoundException('Season not found');
    if (season.status === status) return season;

    if (status === 'open' || status === 'running') {
      const live = await this.seasonRepo.findOne({
        where: { status: In(['open', 'running']) },
      });
      if (live && live.id !== season.id) {
        throw new ConflictException(
          `"${live.title}" is still live. Close it before starting another season.`,
        );
      }
    }

    if (status === 'running' && !season.startsAt) season.startsAt = new Date();
    if (status === 'closed' && !season.endsAt) season.endsAt = new Date();
    season.status = status;
    return this.seasonRepo.save(season);
  }

  // -------------------------------------------------------- review queue --

  /**
   * What is waiting for a verdict, oldest first.
   *
   * Oldest first on purpose: a queue worked newest-first leaves the person who
   * handed in at the start of the round waiting the longest, and their clock
   * already ran before anyone else's.
   */
  async reviewQueue(options: { day?: number; limit?: number } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const qb = this.attemptRepo
      .createQueryBuilder('attempt')
      .innerJoin('attempt.enrolment', 'enrolment')
      .addSelect(['enrolment.id', 'enrolment.handle', 'enrolment.nerve'])
      .where('attempt.status = :status', { status: 'submitted' });

    if (options.day !== undefined) {
      qb.andWhere('attempt.day = :day', { day: options.day });
    }

    const items = await qb
      .orderBy('attempt.createdAt', 'ASC')
      .take(limit)
      .getMany();

    return { items, total: items.length };
  }

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
                  "publishedAt" = CASE WHEN $2 = 'published' THEN now() ELSE NULL END
            WHERE "id" = $1 AND "status" = 'submitted'
            RETURNING "id"`,
          [attemptId, approving ? 'published' : 'rejected'],
        ),
      );
      if (claimed === 0) {
        throw new ConflictException('That attempt has already been settled.');
      }

      if (approving && nerve > 0) {
        // `lastScoredAt` moves with the score because the board breaks ties on
        // it — whoever reached the total first is ahead, and that rule is
        // published in advance.
        await manager.query(
          `UPDATE "game_enrolments"
              SET "nerve" = "nerve" + $2, "lastScoredAt" = now()
            WHERE "id" = $1`,
          [attempt.enrolmentId, nerve],
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

    const settled = await this.attemptRepo.findOne({
      where: { id: attemptId },
    });
    return settled ?? attempt;
  }

  /**
   * Takes a published item back out of the feed.
   *
   * Deliberately does not claw the Nerve back. A score that moves after the
   * fact reorders a board people have already seen, and the compensating
   * ledger entry that does it properly is Level 5's job — doing it here with a
   * bare subtraction would produce a number with no record of why it changed.
   */
  async unpublish(attemptId: string): Promise<GameAttempt> {
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    const claimed = rowsAffected(
      await this.attemptRepo.query(
        `UPDATE "game_attempts"
            SET "status" = 'rejected', "publishedAt" = NULL
          WHERE "id" = $1 AND "status" = 'published'
          RETURNING "id"`,
        [attemptId],
      ),
    );
    if (claimed === 0) {
      throw new ConflictException('That attempt is not in the feed.');
    }

    const fresh = await this.attemptRepo.findOne({ where: { id: attemptId } });
    return fresh ?? attempt;
  }
}
