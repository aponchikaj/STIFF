import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { containsPattern } from '../common/utils/escape-like';
import { GameEnrolment } from './entities/game-enrolment.entity';
import { SeasonsService } from './seasons.service';

export const LEADERBOARD_PAGE_SIZE = 50;
export const MAX_LEADERBOARD_PAGE_SIZE = 100;

/** Below this a search is noise, and it would scan the whole field. */
export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_RESULTS = 20;

export interface BoardRow {
  rank: number;
  handle: string;
  nerve: number;
  heartsRemaining: number;
  heartsTotal: number;
}

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(GameEnrolment)
    private readonly enrolmentRepo: Repository<GameEnrolment>,
    private readonly seasonsService: SeasonsService,
  ) {}

  /**
   * The Nerve board.
   *
   * **Players only.** A watcher has no Nerve and no hearts, so putting them on
   * the board would be a page of zeroes with real names attached — and the cut
   * lines are counted off this list, so a watcher in it would push a player
   * below a line they had actually made.
   *
   * Ties break on who reached the score first, which is published in advance
   * (spec §07) rather than decided when two people finish level.
   */
  async board(
    options: { page?: number; pageSize?: number } = {},
  ): Promise<{ rows: BoardRow[]; total: number; page: number }> {
    const season = await this.seasonsService.current();
    if (!season) return { rows: [], total: 0, page: 1 };

    const page = Math.max(options.page ?? 1, 1);
    const pageSize = Math.min(
      Math.max(options.pageSize ?? LEADERBOARD_PAGE_SIZE, 1),
      MAX_LEADERBOARD_PAGE_SIZE,
    );

    const [rows, total] = await this.enrolmentRepo
      .createQueryBuilder('enrolment')
      .where('enrolment.seasonId = :seasonId', { seasonId: season.id })
      .andWhere('enrolment.role = :role', { role: 'player' })
      .orderBy('enrolment.nerve', 'DESC')
      // NULLS LAST so someone who has not scored yet sorts below everyone who
      // has, rather than above them on an empty timestamp.
      .addOrderBy('enrolment.lastScoredAt', 'ASC', 'NULLS LAST')
      .addOrderBy('enrolment.handle', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      rows: rows.map((enrolment, index) => ({
        rank: (page - 1) * pageSize + index + 1,
        handle: enrolment.handle,
        nerve: enrolment.nerve,
        heartsRemaining: enrolment.heartsRemaining,
        heartsTotal: enrolment.heartsTotal,
      })),
      total,
      page,
    };
  }

  /**
   * Find a player by handle.
   *
   * **Players only, and that is a privacy rule, not a filter.** A watcher chose
   * to be in the audience; making them findable by name in the same box that
   * finds competitors turns a spectator into a search result. The `role` clause
   * is the whole reason this method exists rather than a generic user search.
   */
  async searchPlayers(query: string): Promise<BoardRow[]> {
    const term = query.trim();
    if (term.length < MIN_SEARCH_LENGTH) return [];

    const season = await this.seasonsService.current();
    if (!season) return [];

    const rows = await this.enrolmentRepo
      .createQueryBuilder('enrolment')
      .where('enrolment.seasonId = :seasonId', { seasonId: season.id })
      .andWhere('enrolment.role = :role', { role: 'player' })
      .andWhere(`enrolment.handle ILIKE :term ESCAPE '\\'`, {
        term: containsPattern(term),
      })
      .orderBy('enrolment.nerve', 'DESC')
      .addOrderBy('enrolment.handle', 'ASC')
      .take(MAX_SEARCH_RESULTS)
      .getMany();

    return rows.map((enrolment) => ({
      rank: 0,
      handle: enrolment.handle,
      nerve: enrolment.nerve,
      heartsRemaining: enrolment.heartsRemaining,
      heartsTotal: enrolment.heartsTotal,
    }));
  }
}
