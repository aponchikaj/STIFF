import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GameAttempt } from './entities/game-attempt.entity';
import {
  GameEnrolment,
  type EnrolmentRole,
  type EnrolmentStatus,
} from './entities/game-enrolment.entity';
import { GameSeason, type SeasonStatus } from './entities/game-season.entity';
import { SeasonsService } from './seasons.service';
import {
  VerdictsService,
  type SettleOptions,
  type Verdict,
} from './verdicts.service';

export type { SettleOptions, Verdict };

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
    @InjectRepository(GameEnrolment)
    private readonly enrolmentRepo: Repository<GameEnrolment>,
    private readonly seasonsService: SeasonsService,
    private readonly verdicts: VerdictsService,
  ) {}

  // ---------------------------------------------------------- enrolments --

  /**
   * Who is in the live season. The panel's people screen, and where a
   * reviewer finds the enrolment id behind a flag or a reinstatement.
   */
  async listEnrolments(
    options: {
      status?: EnrolmentStatus;
      role?: EnrolmentRole;
      limit?: number;
    } = {},
  ): Promise<GameEnrolment[]> {
    const season = await this.seasonsService.current();
    if (!season) return [];
    const where: Record<string, unknown> = { seasonId: season.id };
    if (options.status) where.status = options.status;
    if (options.role) where.role = options.role;
    return this.enrolmentRepo.find({
      where,
      order: { demotedAt: 'DESC', nerve: 'DESC', handle: 'ASC' },
      take: Math.min(Math.max(options.limit ?? 200, 1), 500),
    });
  }

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

  /** The verdict. See `VerdictsService`; this is the panel's door to it. */
  settle(attemptId: string, options: SettleOptions): Promise<GameAttempt> {
    return this.verdicts.settle(attemptId, options);
  }

  unpublish(
    attemptId: string,
    options: { by?: string } = {},
  ): Promise<GameAttempt> {
    return this.verdicts.unpublish(attemptId, options);
  }
}
