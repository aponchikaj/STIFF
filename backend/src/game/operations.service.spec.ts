import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { EconomyService } from './economy.service';
import { GameAttemptComment } from './entities/game-attempt-comment.entity';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { SeasonsService } from './seasons.service';
import { WarsService } from './wars.service';

/**
 * The control room's remaining views.
 *
 * The SQL itself is proven against the real schema by running these exact
 * methods inside a rolled-back transaction. What these hold is the logic
 * around it: an empty season is an empty answer, a page cannot be asked
 * for unbounded, and filters are bound rather than pasted into the query.
 */
describe('OperationsService', () => {
  let service: OperationsService;
  let repo: { query: jest.Mock; find: jest.Mock; findOne: jest.Mock };
  let seasons: { current: jest.Mock };

  beforeEach(async () => {
    repo = {
      query: jest.fn().mockResolvedValue([{ total: 0 }]),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    seasons = { current: jest.fn().mockResolvedValue({ id: 's1' }) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationsService,
        { provide: getRepositoryToken(GameAttemptComment), useValue: repo },
        { provide: SeasonsService, useValue: seasons },
      ],
    }).compile();
    service = module.get(OperationsService);
  });

  describe('between seasons', () => {
    beforeEach(() => seasons.current.mockResolvedValue(null));

    it('answers every view with nothing, and asks the database nothing', async () => {
      await expect(service.clans()).resolves.toEqual([]);
      await expect(service.attempts()).resolves.toEqual({
        items: [],
        total: 0,
      });
      await expect(service.votes()).resolves.toEqual([]);
      await expect(service.clocks()).resolves.toEqual([]);
      expect(repo.query).not.toHaveBeenCalled();
    });
  });

  describe('attempts', () => {
    const lastQuery = () =>
      repo.query.mock.calls[repo.query.mock.calls.length - 1] as [
        string,
        unknown[],
      ];

    it('clamps a page size nobody should ask for', async () => {
      await service.attempts({ limit: 100_000 });
      const [, params] = lastQuery();
      expect(params.slice(-2)).toEqual([200, 0]);

      await service.attempts({ limit: 0, offset: -5 });
      expect(lastQuery()[1].slice(-2)).toEqual([1, 0]);
    });

    /**
     * Every filter is a bound parameter. The id that comes in on a query
     * string must never become part of the SQL text.
     */
    it('binds filters and the page rather than writing them into the SQL', async () => {
      const hostile = "e1' OR '1'='1";
      await service.attempts({
        status: 'published',
        day: 2,
        enrolmentId: hostile,
        limit: 10,
        offset: 20,
      });
      const [sql, params] = lastQuery();
      expect(sql).not.toContain(hostile);
      expect(sql).not.toMatch(/LIMIT \d/);
      expect(params).toEqual(['s1', 'published', 2, hostile, 10, 20]);
    });

    it('filters on hidden in both directions, and not at all when omitted', async () => {
      await service.attempts({ hidden: true });
      expect(lastQuery()[0]).toContain('a."hiddenAt" IS NOT NULL');

      await service.attempts({ hidden: false });
      expect(lastQuery()[0]).toContain('a."hiddenAt" IS NULL');

      await service.attempts({});
      expect(lastQuery()[0]).not.toContain('"hiddenAt" IS');
    });
  });

  describe('votes and clocks', () => {
    it('asks for the three unresolved vote states by default', async () => {
      repo.query.mockResolvedValue([]);
      await service.votes();
      const [, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(params[1]).toEqual(['open', 'deferred', 'resolving']);
    });

    it('reads "running" clocks as offered and accepted', async () => {
      repo.query.mockResolvedValue([]);
      await service.clocks('running');
      const [, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(params[1]).toEqual(['offered', 'accepted']);
    });
  });

  describe('setCommentHidden', () => {
    it('is a 404 for a comment that is not there', async () => {
      await expect(service.setCommentHidden('nope', true)).rejects.toThrow(
        NotFoundException,
      );
    });

    /** Hiding twice keeps the first time, so the record of when stands. */
    it('keeps the original hidden time when hidden again', async () => {
      repo.findOne.mockResolvedValue({
        id: 'c1',
        authorHandle: 'op',
        userId: 'u1',
        body: 'x',
        hiddenAt: null,
        createdAt: new Date(),
      });
      await service.setCommentHidden('c1', true);
      const [sql] = repo.query.mock.calls[0] as [string];
      expect(sql).toContain('COALESCE("hiddenAt", now())');
    });

    it('restores by clearing the hidden time', async () => {
      repo.findOne.mockResolvedValue({
        id: 'c1',
        authorHandle: 'op',
        userId: 'u1',
        body: 'x',
        hiddenAt: new Date(),
        createdAt: new Date(),
      });
      await service.setCommentHidden('c1', false);
      const [sql] = repo.query.mock.calls[0] as [string];
      expect(sql).toContain('"hiddenAt" = NULL');
    });
  });
});

describe('OperationsController', () => {
  let controller: OperationsController;
  let economy: { move: jest.Mock; ledger: jest.Mock };
  const admin = { id: 'admin-1' } as never;

  beforeEach(async () => {
    economy = {
      move: jest.fn().mockResolvedValue([]),
      ledger: jest.fn().mockResolvedValue([]),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperationsController],
      providers: [
        { provide: OperationsService, useValue: {} },
        { provide: EconomyService, useValue: economy },
        { provide: WarsService, useValue: { organize: jest.fn() } },
      ],
    }).compile();
    controller = module.get(OperationsController);
  });

  /**
   * Coins can be bought, so a correction is recorded exactly like every
   * other movement: through the ledger, naming the admin, floored at zero.
   */
  it('corrects coins through the ledger and names the admin', async () => {
    economy.move.mockResolvedValue([
      { enrolmentId: 'e1', coinsDelta: -20, coinsAfter: 0 },
    ]);
    const result = await controller.adjustCoins(
      'e1',
      { delta: -50, reason: '  refund reversed  ' },
      admin,
    );
    expect(economy.move).toHaveBeenCalledWith(['e1'], {
      coins: -50,
      reason: 'admin',
      refType: 'admin',
      refId: 'admin-1',
      by: 'admin-1',
    });
    // Reports what actually moved: a 50-coin deduction from 20 moves 20.
    expect(result).toEqual({
      enrolmentId: 'e1',
      coinsDelta: -20,
      coins: 0,
      reason: 'refund reversed',
    });
  });

  it('is a 404 for an enrolment that is not there', async () => {
    economy.move.mockResolvedValue([]);
    await expect(
      controller.adjustCoins('nope', { delta: 5, reason: 'goodwill' }, admin),
    ).rejects.toThrow(NotFoundException);
  });

  it('reads the coin ledger with the limit it was given', async () => {
    await controller.coinLedger('e1', { limit: 25 });
    expect(economy.ledger).toHaveBeenCalledWith('e1', 25);
  });
});
