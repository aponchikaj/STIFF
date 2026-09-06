import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { GameEnrolment } from './entities/game-enrolment.entity';
import {
  LeaderboardService,
  MAX_SEARCH_RESULTS,
  escapeLike,
} from './leaderboard.service';
import { SeasonsService } from './seasons.service';

/**
 * The board and the search box a watcher lands on.
 *
 * Both are players-only, and in the search that is a privacy rule rather than
 * a filter: a watcher chose to be in the audience, and making them findable by
 * name in the box that finds competitors turns a spectator into a result.
 */

function queryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getMany = jest.fn().mockResolvedValue([]);
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  return qb;
}

function player(handle: string, nerve: number) {
  return {
    handle,
    nerve,
    heartsRemaining: 2,
    heartsTotal: 3,
  } as GameEnrolment;
}

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let qb: Record<string, jest.Mock>;
  let seasons: { current: jest.Mock };

  beforeEach(async () => {
    qb = queryBuilder();
    seasons = { current: jest.fn().mockResolvedValue({ id: 's1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        {
          provide: getRepositoryToken(GameEnrolment),
          useValue: { createQueryBuilder: jest.fn(() => qb) },
        },
        { provide: SeasonsService, useValue: seasons },
      ],
    }).compile();

    service = module.get(LeaderboardService);
  });

  describe('board', () => {
    it('is empty between seasons rather than an error', async () => {
      seasons.current.mockResolvedValue(null);
      await expect(service.board()).resolves.toEqual({
        rows: [],
        total: 0,
        page: 1,
      });
    });

    /**
     * A watcher has no Nerve and no hearts. On the board they would be a row of
     * zeroes with a real name on it — and because the cut lines are counted off
     * this list, they would push a player below a line they had actually made.
     */
    it('asks only for players', async () => {
      await service.board();
      expect(qb.andWhere).toHaveBeenCalledWith('enrolment.role = :role', {
        role: 'player',
      });
    });

    it('ranks by Nerve, highest first', async () => {
      await service.board();
      expect(qb.orderBy).toHaveBeenCalledWith('enrolment.nerve', 'DESC');
    });

    /**
     * Published in advance (spec §07): level scores are separated by who got
     * there first. `NULLS LAST` keeps someone who has never scored below
     * everyone who has, rather than on top of an empty timestamp.
     */
    it('breaks ties on who reached the score first', async () => {
      await service.board();
      expect(qb.addOrderBy).toHaveBeenCalledWith(
        'enrolment.lastScoredAt',
        'ASC',
        'NULLS LAST',
      );
    });

    it('numbers the ranks continuously across pages', async () => {
      qb.getManyAndCount.mockResolvedValue([
        [player('a', 90), player('b', 80)],
        120,
      ]);
      const result = await service.board({ page: 3, pageSize: 2 });
      expect(result.rows.map((r) => r.rank)).toEqual([5, 6]);
      expect(result.total).toBe(120);
    });

    it('clamps a page size nobody should be asking for', async () => {
      await service.board({ pageSize: 5000 });
      expect(qb.take).toHaveBeenCalledWith(100);

      await service.board({ pageSize: 0 });
      expect(qb.take).toHaveBeenCalledWith(1);
    });

    it('treats a page below one as the first page', async () => {
      await service.board({ page: -4, pageSize: 10 });
      expect(qb.skip).toHaveBeenCalledWith(0);
    });
  });

  describe('searchPlayers', () => {
    it('says nothing for a term too short to mean anything', async () => {
      await expect(service.searchPlayers('a')).resolves.toEqual([]);
      await expect(service.searchPlayers('  ')).resolves.toEqual([]);
      expect(qb.getMany).not.toHaveBeenCalled();
    });

    /** The whole reason this is not a generic user search. */
    it('never returns a watcher', async () => {
      await service.searchPlayers('ast');
      expect(qb.andWhere).toHaveBeenCalledWith('enrolment.role = :role', {
        role: 'player',
      });
    });

    it('is scoped to the season being played', async () => {
      await service.searchPlayers('ast');
      expect(qb.where).toHaveBeenCalledWith('enrolment.seasonId = :seasonId', {
        seasonId: 's1',
      });
    });

    it('caps how much one search can pull back', async () => {
      await service.searchPlayers('ast');
      expect(qb.take).toHaveBeenCalledWith(MAX_SEARCH_RESULTS);
    });

    it('is empty between seasons', async () => {
      seasons.current.mockResolvedValue(null);
      await expect(service.searchPlayers('ast')).resolves.toEqual([]);
    });

    it('returns matches with their score and hearts', async () => {
      qb.getMany.mockResolvedValue([player('asterisk', 140)]);
      await expect(service.searchPlayers('ast')).resolves.toEqual([
        {
          rank: 0,
          handle: 'asterisk',
          nerve: 140,
          heartsRemaining: 2,
          heartsTotal: 3,
        },
      ]);
    });
  });
});

describe('escapeLike', () => {
  /**
   * Not injection — the term is parameterised — but `_` is a single-character
   * wildcard, so an unescaped search for it matches every handle in the season.
   */
  it('stops a wildcard from matching the whole field', () => {
    expect(escapeLike('_')).toBe('\\_');
    expect(escapeLike('%')).toBe('\\%');
    expect(escapeLike('100%_sure')).toBe('100\\%\\_sure');
  });

  it('escapes the escape character itself', () => {
    expect(escapeLike('a\\b')).toBe('a\\\\b');
  });

  it('leaves an ordinary handle alone', () => {
    expect(escapeLike('asterisk')).toBe('asterisk');
  });
});
