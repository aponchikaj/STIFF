import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
}
