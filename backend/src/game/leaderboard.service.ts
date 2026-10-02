import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { containsPattern } from '../common/utils/escape-like';
import { User } from '../users/user.entity';
import {
  GameEnrolment,
  type DemotionReason,
  type EnrolmentStatus,
} from './entities/game-enrolment.entity';
import { BOARD_NEIGHBOURS } from './rules';
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
  coins: number;
  heartsRemaining: number;
  heartsTotal: number;
}

export interface Board {
  rows: BoardRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** One player's place on the board, or why they have none. */
export interface Standing {
  onBoard: boolean;
  rank: number | null;
  total: number;
  handle: string;
  nerve: number;
  coins: number;
  heartsRemaining: number;
  heartsTotal: number;
  status: EnrolmentStatus;
  demotionReason: DemotionReason | null;
  /** The rows either side of them, this one included, in board order. */
  around: BoardRow[];
}

/** The columns the tie-break needs; a full enrolment has them all. */
type Placed = Pick<
  GameEnrolment,
  'id' | 'seasonId' | 'nerve' | 'lastScoredAt' | 'handle'
>;

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
   * the board would be a page of zeroes with real names attached.
   *
   * Ties break on who reached the score first, which is published in advance
   * (spec §07) rather than decided when two people finish level.
   */
  async board(
    options: { page?: number; pageSize?: number } = {},
  ): Promise<Board> {
    const page = Math.max(options.page ?? 1, 1);
    const pageSize = Math.min(
      Math.max(options.pageSize ?? LEADERBOARD_PAGE_SIZE, 1),
      MAX_LEADERBOARD_PAGE_SIZE,
    );
    const empty: Board = { rows: [], total: 0, page, pageSize };

    const season = await this.seasonsService.current();
    if (!season) return empty;

    const [rows, total] = await this.ordered(season.id)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      ...empty,
      rows: rows.map((enrolment, index) =>
        toRow(enrolment, (page - 1) * pageSize + index + 1),
      ),
      total,
    };
  }

  /**
   * Where one enrolment stands, by the board's own rule: one more than the
   * number of players ahead of it. Ahead means more Nerve, or the same Nerve
   * reached earlier, or — level on both — a handle that sorts first. Someone
   * who has never scored is behind everyone who has.
   *
   * `null` for anyone not on the board: a watcher, or a player demoted to
   * one. Their Nerve is still theirs, but a rank is a place in a race they
   * are no longer in. A rank is a standing, never a cut — nobody is dropped
   * from the game for where they sit on this list.
   */
  async rankOf(enrolmentId: string): Promise<number | null> {
    const enrolment = await this.enrolmentRepo.findOne({
      where: { id: enrolmentId },
    });
    if (!enrolment || enrolment.role !== 'player') return null;
    return this.rankAmongPlayers(enrolment);
  }

  /**
   * The caller's standing: rank, the lines, and the rows either side of them.
   *
   * For a player who has been moved to watcher the answer is honest rather
   * than empty — the Nerve they finished with, and why they are off the board.
   */
  async standing(user: User): Promise<Standing> {
    const season = await this.seasonsService.current();
    if (!season) throw new NotFoundException('There is no season running.');
    const enrolment = await this.enrolmentRepo.findOne({
      where: { seasonId: season.id, userId: user.id },
    });
    if (!enrolment) {
      throw new NotFoundException('You have not joined this season.');
    }

    const total = await this.players(season.id).getCount();
    const base = {
      total,
      handle: enrolment.handle,
      nerve: enrolment.nerve,
      coins: enrolment.coins ?? 0,
      heartsRemaining: enrolment.heartsRemaining,
      heartsTotal: enrolment.heartsTotal,
      status: enrolment.status ?? 'active',
      demotionReason: enrolment.demotionReason ?? null,
    };

    if (enrolment.role !== 'player') {
      return { ...base, onBoard: false, rank: null, around: [] };
    }

    const rank = await this.rankAmongPlayers(enrolment);
    const first = Math.max(rank - BOARD_NEIGHBOURS, 1);
    const around = await this.ordered(season.id)
      .skip(first - 1)
      .take(BOARD_NEIGHBOURS * 2 + 1)
      .getMany();

    return {
      ...base,
      onBoard: true,
      rank,
      around: around.map((row, index) => toRow(row, first + index)),
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

    const rows = await this.players(season.id)
      .andWhere(`enrolment.handle ILIKE :term ESCAPE '\\'`, {
        term: containsPattern(term),
      })
      .orderBy('enrolment.nerve', 'DESC')
      .addOrderBy('enrolment.handle', 'ASC')
      .take(MAX_SEARCH_RESULTS)
      .getMany();

    return rows.map((enrolment) => toRow(enrolment, 0));
  }

  /** The season's players, and nobody else. Every read here starts from it. */
  private players(seasonId: string): SelectQueryBuilder<GameEnrolment> {
    return this.enrolmentRepo
      .createQueryBuilder('enrolment')
      .where('enrolment.seasonId = :seasonId', { seasonId })
      .andWhere('enrolment.role = :role', { role: 'player' });
  }

  /**
   * The board's order, in one place, so the page, the standing and the rank
   * can never disagree about who is ahead. `IDX_game_enrolments_board`
   * (`seasonId, role, nerve DESC`) is the index behind it; the tie-break
   * columns are a sort within equal scores, not a scan.
   */
  private ordered(seasonId: string): SelectQueryBuilder<GameEnrolment> {
    return (
      this.players(seasonId)
        .orderBy('enrolment.nerve', 'DESC')
        // NULLS LAST so someone who has not scored yet sorts below everyone
        // who has, rather than above them on an empty timestamp.
        .addOrderBy('enrolment.lastScoredAt', 'ASC', 'NULLS LAST')
        .addOrderBy('enrolment.handle', 'ASC')
    );
  }

  /** The count behind `rankOf`, for a row already known to be a player. */
  private async rankAmongPlayers(mine: Placed): Promise<number> {
    const tie = mine.lastScoredAt
      ? '(enrolment.lastScoredAt < :at OR (enrolment.lastScoredAt = :at AND enrolment.handle < :handle))'
      : '(enrolment.lastScoredAt IS NOT NULL OR enrolment.handle < :handle)';
    const ahead = await this.players(mine.seasonId)
      .andWhere(
        `(enrolment.nerve > :nerve OR (enrolment.nerve = :nerve AND ${tie}))`,
        {
          nerve: mine.nerve,
          at: mine.lastScoredAt ?? null,
          handle: mine.handle,
        },
      )
      .getCount();
    return ahead + 1;
  }
}

function toRow(enrolment: GameEnrolment, rank: number): BoardRow {
  return {
    rank,
    handle: enrolment.handle,
    nerve: enrolment.nerve,
    coins: enrolment.coins ?? 0,
    heartsRemaining: enrolment.heartsRemaining,
    heartsTotal: enrolment.heartsTotal,
  };
}
