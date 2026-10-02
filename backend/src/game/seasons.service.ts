import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { returnedRows } from '../common/utils/returned-rows';
import { GameSeason } from './entities/game-season.entity';

/**
 * The one season the front door is talking about.
 *
 * There is deliberately no "pick a season" in the API. A player enrols in
 * whatever is live and the feed shows whatever is live; browsing old seasons
 * is an archive feature, and building it before there is a second season is
 * how the enrolment rules end up parameterised by something nobody sends.
 */
@Injectable()
export class SeasonsService {
  private readonly logger = new Logger(SeasonsService.name);

  constructor(
    @InjectRepository(GameSeason)
    private readonly seasonRepo: Repository<GameSeason>,
  ) {}

  /** Open or running, newest first. Null when the game is between seasons. */
  async current(): Promise<GameSeason | null> {
    return this.seasonRepo.findOne({
      where: { status: In(['open', 'running']) },
      order: { createdAt: 'DESC' },
    });
  }

  async requireCurrent(): Promise<GameSeason> {
    const season = await this.current();
    if (!season) {
      throw new NotFoundException('No season is running right now.');
    }
    return season;
  }

  /**
   * Starts any `open` season whose `startsAt` has come.
   *
   * The opals count from `startsAt`, and draws need `running` — so without
   * this, 001 would unlock on every screen at 00:00 while the server kept
   * refusing to deal a task until someone flipped the season by hand. One
   * conditional UPDATE: run twice in the same minute, it starts nothing
   * the second time. Called from the task-clock sweep, under its lock.
   */
  async startDue(): Promise<number> {
    const started = returnedRows(
      await this.seasonRepo.query(
        `UPDATE "game_seasons"
            SET "status" = 'running', "updatedAt" = now()
          WHERE "status" = 'open'
            AND "startsAt" IS NOT NULL
            AND "startsAt" <= now()
          RETURNING "id", "title"`,
      ),
    ) as { id: string; title: string }[];
    for (const season of started) {
      this.logger.log(`Season "${season.title}" started on schedule.`);
    }
    return started.length;
  }
}
