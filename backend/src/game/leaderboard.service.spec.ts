import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '../users/user.entity';
import { GameEnrolment } from './entities/game-enrolment.entity';
import { LeaderboardService, MAX_SEARCH_RESULTS } from './leaderboard.service';
import { BOARD_NEIGHBOURS } from './rules';
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
  qb.getCount = jest.fn().mockResolvedValue(0);
  return qb;
}

function player(handle: string, nerve: number, coins = 7) {
  return {
    id: `e-${handle}`,
    seasonId: 's1',
    role: 'player',
    status: 'active',
    demotionReason: null,
    handle,
    nerve,
    coins,
    heartsRemaining: 2,
    heartsTotal: 3,
    lastScoredAt: new Date('2026-09-11T10:00:00.000Z'),
  } as GameEnrolment;
}

const me = { id: 'u1' } as User;

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let qb: Record<string, jest.Mock>;
  let repo: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let seasons: { current: jest.Mock };

  beforeEach(async () => {
    qb = queryBuilder();
    repo = {
      createQueryBuilder: jest.fn(() => qb),
      findOne: jest.fn().mockResolvedValue(null),
    };
    seasons = { current: jest.fn().mockResolvedValue({ id: 's1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: getRepositoryToken(GameEnrolment), useValue: repo },
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
        pageSize: 50,
      });
    });

    /**
     * The board ranks and never cuts. A row carries a position, not a verdict
     * about whether its player is still in the game, so there is nothing on it
     * to say which round they survived into.
     */
    it('puts no elimination mark on a row', async () => {
      qb.getManyAndCount.mockResolvedValue([
        [player('a', 90), player('b', 80)],
        2000,
      ]);
      const result = await service.board({ page: 1, pageSize: 2 });
      for (const row of result.rows) {
        expect(row).not.toHaveProperty('cut');
      }
      expect(result).not.toHaveProperty('cutLines');
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

    it('returns matches with their score, coins and hearts', async () => {
      qb.getMany.mockResolvedValue([player('asterisk', 140)]);
      await expect(service.searchPlayers('ast')).resolves.toEqual([
        {
          rank: 0,
          handle: 'asterisk',
          nerve: 140,
          coins: 7,
          heartsRemaining: 2,
          heartsTotal: 3,
        },
      ]);
    });

    /** A row written before coins existed reads as none, not as undefined. */
    it('reads a row with no coins column as zero', async () => {
      const row = player('old', 1);
      delete (row as { coins?: number }).coins;
      qb.getMany.mockResolvedValue([row]);
      expect((await service.searchPlayers('old'))[0].coins).toBe(0);
    });
  });

  describe('rankOf', () => {
    it('is null for an enrolment that is not there', async () => {
      await expect(service.rankOf('nope')).resolves.toBeNull();
      expect(qb.getCount).not.toHaveBeenCalled();
    });

    /** A rank is a place in a race a watcher is not in. */
    it('is null for a watcher, demoted or otherwise', async () => {
      repo.findOne.mockResolvedValue({ ...player('w', 300), role: 'watcher' });
      await expect(service.rankOf('e-w')).resolves.toBeNull();
      expect(qb.getCount).not.toHaveBeenCalled();
    });

    it('is one more than the number of players ahead', async () => {
      repo.findOne.mockResolvedValue(player('kate', 120));
      qb.getCount.mockResolvedValue(11);
      await expect(service.rankOf('e-kate')).resolves.toBe(12);
    });

    /**
     * Ahead means more Nerve, or the same Nerve reached first, or level on
     * both and a handle that sorts first — the board's order, restated as a
     * count, so the two can never disagree.
     */
    it("counts ahead by the board's own tie-break", async () => {
      const mine = player('kate', 120);
      repo.findOne.mockResolvedValue(mine);
      await service.rankOf('e-kate');
      expect(qb.where).toHaveBeenCalledWith('enrolment.seasonId = :seasonId', {
        seasonId: 's1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('enrolment.role = :role', {
        role: 'player',
      });
      const [clause, params] = qb.andWhere.mock.calls[1] as [
        string,
        Record<string, unknown>,
      ];
      expect(clause).toContain('enrolment.nerve > :nerve');
      expect(clause).toContain('enrolment.lastScoredAt < :at');
      expect(clause).toContain('enrolment.handle < :handle');
      expect(params).toEqual({
        nerve: 120,
        at: mine.lastScoredAt,
        handle: 'kate',
      });
    });

    /** Someone who has never scored is behind everyone level who has. */
    it('puts a never-scored player behind every scored one at the same Nerve', async () => {
      repo.findOne.mockResolvedValue({
        ...player('new', 0),
        lastScoredAt: null,
      });
      await service.rankOf('e-new');
      const [clause, params] = qb.andWhere.mock.calls[1] as [
        string,
        Record<string, unknown>,
      ];
      expect(clause).toContain('enrolment.lastScoredAt IS NOT NULL');
      expect(clause).not.toContain('lastScoredAt < :at');
      expect(params).toMatchObject({ nerve: 0, at: null, handle: 'new' });
    });
  });

  describe('standing', () => {
    it('is a 404 between seasons', async () => {
      seasons.current.mockResolvedValue(null);
      await expect(service.standing(me)).rejects.toThrow(NotFoundException);
    });

    it('is a 404 for someone not in the season', async () => {
      await expect(service.standing(me)).rejects.toThrow(NotFoundException);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { seasonId: 's1', userId: 'u1' },
      });
    });

    /** Honest rather than empty: the Nerve they finished with, and why. */
    it('tells a demoted player they are off the board, and why', async () => {
      repo.findOne.mockResolvedValue({
        ...player('kate', 300),
        role: 'watcher',
        status: 'demoted',
        demotionReason: 'out_of_hearts',
      });
      qb.getCount.mockResolvedValue(40);
      const result = await service.standing(me);
      expect(result).toMatchObject({
        onBoard: false,
        rank: null,
        total: 40,
        nerve: 300,
        status: 'demoted',
        demotionReason: 'out_of_hearts',
        around: [],
      });
      expect(qb.getMany).not.toHaveBeenCalled();
    });

    it('gives a player their rank, their cut and the rows around them', async () => {
      repo.findOne.mockResolvedValue(player('kate', 120));
      // 40 players; 11 ahead → rank 12.
      qb.getCount.mockResolvedValueOnce(40).mockResolvedValueOnce(11);
      qb.getMany.mockResolvedValue([
        player('a', 150),
        player('b', 140),
        player('c', 130),
        player('kate', 120),
        player('d', 110),
      ]);

      const result = await service.standing(me);

      expect(result).toMatchObject({ onBoard: true, rank: 12, total: 40 });
      // The window starts BOARD_NEIGHBOURS above them and is numbered from there.
      expect(qb.skip).toHaveBeenCalledWith(12 - BOARD_NEIGHBOURS - 1);
      expect(qb.take).toHaveBeenCalledWith(BOARD_NEIGHBOURS * 2 + 1);
      expect(result.around.map((r) => [r.handle, r.rank])).toEqual([
        ['a', 9],
        ['b', 10],
        ['c', 11],
        ['kate', 12],
        ['d', 13],
      ]);
    });

    /** Near the top the window cannot start above rank one. */
    it('starts the window at the top for a leader', async () => {
      repo.findOne.mockResolvedValue(player('kate', 900));
      qb.getCount.mockResolvedValueOnce(40).mockResolvedValueOnce(0);
      qb.getMany.mockResolvedValue([player('kate', 900), player('b', 800)]);
      const result = await service.standing(me);
      expect(result.rank).toBe(1);
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(result.around.map((r) => r.rank)).toEqual([1, 2]);
    });
  });
});
