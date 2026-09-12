import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { EconomyService } from './economy.service';
import { GameCoinLedger } from './entities/game-coin-ledger.entity';
import { GameEnrolment } from './entities/game-enrolment.entity';
import { GameScoreLedger } from './entities/game-score-ledger.entity';

/**
 * Coins and score move in one statement and get written down.
 *
 * What these hold is the arithmetic the ledger depends on: the delta stored
 * is what actually moved, not what was asked, so the running total on the
 * enrolment always equals the sum of its ledger rows.
 */

/** A row the UPDATE ... RETURNING hands back. */
function moved(
  overrides: Partial<{
    id: string;
    userId: string;
    coinsBefore: number;
    coinsAfter: number;
    nerveBefore: number;
    nerveAfter: number;
  }> = {},
) {
  return {
    id: 'e1',
    userId: 'u1',
    coinsBefore: 5,
    coinsAfter: 8,
    nerveBefore: 10,
    nerveAfter: 20,
    ...overrides,
  };
}

describe('EconomyService', () => {
  let service: EconomyService;
  let enrolmentRepo: { findOne: jest.Mock };
  let ledgerRepo: { find: jest.Mock };
  let scoreLedgerRepo: { find: jest.Mock };
  let manager: { query: jest.Mock; insert: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let notifications: { notify: jest.Mock };

  beforeEach(async () => {
    enrolmentRepo = { findOne: jest.fn().mockResolvedValue(null) };
    ledgerRepo = { find: jest.fn().mockResolvedValue([]) };
    scoreLedgerRepo = { find: jest.fn().mockResolvedValue([]) };
    manager = {
      query: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) =>
        cb(manager),
      ),
    };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EconomyService,
        { provide: getRepositoryToken(GameEnrolment), useValue: enrolmentRepo },
        { provide: getRepositoryToken(GameCoinLedger), useValue: ledgerRepo },
        {
          provide: getRepositoryToken(GameScoreLedger),
          useValue: scoreLedgerRepo,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(EconomyService);
  });

  describe('move', () => {
    it('does nothing for no enrolments', async () => {
      const result = await service.move([], {
        coins: 5,
        reason: 'task_reward',
      });
      expect(result).toEqual([]);
      expect(manager.query).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('does nothing for a movement of nothing', async () => {
      const result = await service.move(['e1'], {
        coins: 0,
        nerve: 0,
        reason: 'task_reward',
      });
      expect(result).toEqual([]);
      expect(manager.query).not.toHaveBeenCalled();
    });

    it('locks the rows and floors coins at zero in the statement', async () => {
      manager.query.mockResolvedValue([moved()]);
      await service.move(['e1'], { coins: -3, reason: 'task_penalty' });
      const [sql] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('FOR UPDATE');
      expect(sql).toContain('GREATEST(e."coins" + $2, 0)');
      expect(sql).toContain('"lastScoredAt" = CASE WHEN $3 > 0');
    });

    it('binds the de-duplicated ids, the coins and the nerve', async () => {
      manager.query.mockResolvedValue([moved()]);
      await service.move(['e1', 'e2', 'e1'], {
        coins: 4,
        nerve: 10,
        reason: 'task_reward',
      });
      const [, params] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual([['e1', 'e2'], 4, 10]);
    });

    /** Nerve is awarded only — a clawback is a ledger job, not a negative here. */
    /**
     * A negative movement is a clawback. It goes through as asked and the
     * statement floors the score at zero, so what the ledger records is what
     * actually moved rather than what was requested.
     */
    it('passes a negative nerve through and floors it in the statement', async () => {
      manager.query.mockResolvedValue([moved()]);
      await service.move(['e1'], {
        coins: 2,
        nerve: -50,
        reason: 'task_reward',
      });
      const [sql, params] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(params[2]).toBe(-50);
      expect(sql).toContain('GREATEST(e."nerve" + $3, 0)');
    });

    it('reports what actually moved, from before and after', async () => {
      manager.query.mockResolvedValue([
        moved({ coinsBefore: 1, coinsAfter: 0, nerveBefore: 3, nerveAfter: 3 }),
      ]);
      const [result] = await service.move(['e1'], {
        coins: -3,
        reason: 'task_penalty',
      });
      // A three-coin penalty on a one-coin balance moves one coin.
      expect(result).toEqual({
        enrolmentId: 'e1',
        userId: 'u1',
        coinsDelta: -1,
        coinsAfter: 0,
        nerveDelta: 0,
        nerveAfter: 3,
      });
    });

    it('writes a ledger row carrying the real delta and the balance after', async () => {
      manager.query.mockResolvedValue([
        moved({ coinsBefore: 5, coinsAfter: 8 }),
      ]);
      await service.move(['e1'], {
        coins: 3,
        reason: 'task_reward',
        refType: 'attempt',
        refId: 'a1',
      });
      expect(manager.insert).toHaveBeenCalledWith(GameCoinLedger, {
        enrolmentId: 'e1',
        delta: 3,
        balanceAfter: 8,
        reason: 'task_reward',
        refType: 'attempt',
        refId: 'a1',
      });
    });

    it('writes no ledger row when nothing moved', async () => {
      manager.query.mockResolvedValue([
        moved({ coinsBefore: 0, coinsAfter: 0, nerveBefore: 3, nerveAfter: 3 }),
      ]);
      await service.move(['e1'], { coins: -2, reason: 'task_penalty' });
      expect(manager.insert).not.toHaveBeenCalled();
    });

    /** The score has its own ledger, written in the same transaction. */
    it('writes a score ledger row carrying the real delta and the score after', async () => {
      manager.query.mockResolvedValue([
        moved({
          coinsBefore: 5,
          coinsAfter: 5,
          nerveBefore: 10,
          nerveAfter: 35,
        }),
      ]);
      await service.move(['e1'], {
        coins: 0,
        nerve: 25,
        reason: 'task_reward',
        refType: 'attempt',
        refId: 'a1',
        by: 'admin-1',
      });
      expect(manager.insert).toHaveBeenCalledTimes(1);
      expect(manager.insert).toHaveBeenCalledWith(GameScoreLedger, {
        enrolmentId: 'e1',
        delta: 25,
        scoreAfter: 35,
        reason: 'task_reward',
        refType: 'attempt',
        refId: 'a1',
        by: 'admin-1',
      });
    });

    /** A clawback moves no coins, so it names its own score reason. */
    it('lets a movement name the score reason separately', async () => {
      manager.query.mockResolvedValue([
        moved({
          coinsBefore: 5,
          coinsAfter: 5,
          nerveBefore: 40,
          nerveAfter: 15,
        }),
      ]);
      await service.move(['e1'], {
        coins: 0,
        nerve: -25,
        reason: 'admin',
        scoreReason: 'clawback',
        refType: 'attempt',
        refId: 'a1',
      });
      const [, row] = manager.insert.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(row).toMatchObject({
        delta: -25,
        scoreAfter: 15,
        reason: 'clawback',
      });
      expect(row.by).toBeNull();
    });

    /** A coin reason the score ledger does not know is recorded as a correction. */
    it('falls back to admin for a coin-only reason', async () => {
      manager.query.mockResolvedValue([
        moved({
          coinsBefore: 5,
          coinsAfter: 2,
          nerveBefore: 10,
          nerveAfter: 20,
        }),
      ]);
      await service.move(['e1'], {
        coins: -3,
        nerve: 10,
        reason: 'task_penalty',
      });
      const rows = manager.insert.mock.calls.map(
        ([entity, row]) =>
          [entity, (row as { reason: string }).reason] as const,
      );
      expect(rows).toEqual([
        [GameCoinLedger, 'task_penalty'],
        [GameScoreLedger, 'admin'],
      ]);
    });

    it('stores null refs when none were given', async () => {
      manager.query.mockResolvedValue([moved()]);
      await service.move(['e1'], { coins: 3, reason: 'admin' });
      const [, row] = manager.insert.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(row.refType).toBeNull();
      expect(row.refId).toBeNull();
    });

    it('opens its own transaction when none is passed', async () => {
      manager.query.mockResolvedValue([moved()]);
      await service.move(['e1'], { coins: 1, reason: 'task_reward' });
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    /** Inside a verdict's transaction the movement must be part of it. */
    it('uses the manager it is handed instead of a new transaction', async () => {
      const outer = {
        query: jest.fn().mockResolvedValue([moved()]),
        insert: jest.fn().mockResolvedValue(undefined),
      };
      await service.move(
        ['e1'],
        { coins: 1, reason: 'task_reward' },
        outer as never,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(outer.query).toHaveBeenCalledTimes(1);
      // One coin row and one score row — the fixture moves both.
      expect(outer.insert).toHaveBeenCalledTimes(2);
      expect(manager.query).not.toHaveBeenCalled();
    });
  });

  describe('scoreLedger', () => {
    it('reads newest first, clamped like the coin ledger', async () => {
      await service.scoreLedger('e1', 900);
      expect(scoreLedgerRepo.find).toHaveBeenCalledWith({
        where: { enrolmentId: 'e1' },
        order: { createdAt: 'DESC' },
        take: 200,
      });
    });
  });

  describe('ledger', () => {
    it('reads newest first', async () => {
      await service.ledger('e1');
      expect(ledgerRepo.find).toHaveBeenCalledWith({
        where: { enrolmentId: 'e1' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });

    it('clamps the limit into 1..200', async () => {
      await service.ledger('e1', 0);
      expect(
        (ledgerRepo.find.mock.calls[0] as [{ take: number }])[0].take,
      ).toBe(1);
      await service.ledger('e1', 5000);
      expect(
        (ledgerRepo.find.mock.calls[1] as [{ take: number }])[0].take,
      ).toBe(200);
    });
  });

  describe('announce', () => {
    const movements = [
      {
        enrolmentId: 'e1',
        userId: 'u1',
        coinsDelta: 2,
        coinsAfter: 5,
        nerveDelta: 0,
        nerveAfter: 0,
      },
      {
        enrolmentId: 'e2',
        userId: 'u2',
        coinsDelta: -1,
        coinsAfter: 0,
        nerveDelta: 0,
        nerveAfter: 0,
      },
    ];

    it('tells each person, with the body built from their movement', async () => {
      await service.announce(movements, 'Coins', (m) => `now ${m.coinsAfter}`);
      expect(notifications.notify).toHaveBeenCalledTimes(2);
      expect(notifications.notify).toHaveBeenCalledWith(
        'u1',
        'system',
        'Coins',
        'now 5',
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        'u2',
        'system',
        'Coins',
        'now 0',
      );
    });

    it('carries on when one notification fails', async () => {
      notifications.notify
        .mockRejectedValueOnce(new Error('inbox gone'))
        .mockResolvedValueOnce(undefined);
      await expect(
        service.announce(movements, 'Coins', () => 'x'),
      ).resolves.toBeUndefined();
      expect(notifications.notify).toHaveBeenCalledTimes(2);
    });
  });

  describe('balance', () => {
    it('reads the running total', async () => {
      enrolmentRepo.findOne.mockResolvedValue({ id: 'e1', coins: 7 });
      expect(await service.balance('e1')).toBe(7);
    });

    it('is zero for an enrolment that does not exist', async () => {
      expect(await service.balance('nope')).toBe(0);
    });
  });

  /**
   * Buying refuses rather than floors: a purchase on a balance that cannot
   * cover it is not a purchase, and the check is in the statement so two
   * buys racing on the last coins cannot both succeed.
   */
  describe('charge', () => {
    const charged = { id: 'e1', userId: 'u1', coins: 6, nerve: 3 };

    beforeEach(() => {
      manager.query.mockResolvedValue([charged]);
    });

    it('takes the coins with a condition on the balance', async () => {
      await service.charge('e1', 4, { reason: 'purchase' });
      const [sql, params] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/"coins" >= \$2/);
      expect(params).toEqual(['e1', 4]);
    });

    it('refuses a short balance', async () => {
      manager.query.mockResolvedValue([]);
      await expect(
        service.charge('e1', 40, { reason: 'purchase' }),
      ).rejects.toThrow(/Not enough coins/);
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('writes the ledger row with the balance after', async () => {
      await service.charge('e1', 4, {
        reason: 'purchase',
        refType: 'purchase',
        refId: 'p1',
      });
      expect(manager.insert).toHaveBeenCalledWith(GameCoinLedger, {
        enrolmentId: 'e1',
        delta: -4,
        balanceAfter: 6,
        reason: 'purchase',
        refType: 'purchase',
        refId: 'p1',
      });
    });

    it('writes no ledger row for a free item', async () => {
      await service.charge('e1', 0, { reason: 'purchase' });
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('treats a negative price as free', async () => {
      await service.charge('e1', -3, { reason: 'purchase' });
      const [, params] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['e1', 0]);
    });

    it('reports what moved', async () => {
      const result = await service.charge('e1', 4, { reason: 'purchase' });
      expect(result).toEqual({
        enrolmentId: 'e1',
        userId: 'u1',
        coinsDelta: -4,
        coinsAfter: 6,
        nerveDelta: 0,
        nerveAfter: 3,
      });
    });

    it('runs inside a caller’s transaction when one is passed', async () => {
      const outer = {
        query: jest.fn().mockResolvedValue([charged]),
        insert: jest.fn().mockResolvedValue(undefined),
      };
      await service.charge('e1', 4, { reason: 'purchase' }, outer as never);
      expect(outer.query).toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('opens its own transaction otherwise', async () => {
      await service.charge('e1', 4, { reason: 'purchase' });
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });
  });
});
