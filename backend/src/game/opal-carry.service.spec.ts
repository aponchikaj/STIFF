import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EconomyService } from './economy.service';
import { OpalCarryService } from './opal-carry.service';

/**
 * Bought opals outliving their season.
 *
 * What carries is the unspent part — `LEAST(coins, paidOpals)` — out of
 * the closed season's balance and into the live one, written as a pair of
 * ledger rows, and claimed once so a double join cannot carry twice.
 */

describe('OpalCarryService', () => {
  let service: OpalCarryService;
  let dataSource: { query: jest.Mock; transaction: jest.Mock };
  let manager: { query: jest.Mock };
  let economy: { move: jest.Mock };
  /** Per source id: what the claim returns (null = already claimed). */
  let claimable: Record<string, number | null>;

  const target = { id: 'e-new', seasonId: 's2' };

  beforeEach(async () => {
    claimable = { 'e-old': 60 };
    manager = {
      query: jest.fn((sql: string, params: unknown[]) => {
        if (sql.includes('SET "opalsCarriedAt" = now()')) {
          const amount = claimable[params[0] as string];
          const rows =
            amount === null || amount === undefined ? [] : [{ amount }];
          return Promise.resolve([rows, rows.length]);
        }
        return Promise.resolve([]);
      }),
    };
    dataSource = {
      query: jest.fn().mockResolvedValue([{ id: 'e-old' }]),
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
    };
    economy = { move: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpalCarryService,
        { provide: DataSource, useValue: dataSource },
        { provide: EconomyService, useValue: economy },
      ],
    }).compile();

    service = module.get(OpalCarryService);
  });

  it('does nothing, and opens no transaction, when nothing is held', async () => {
    dataSource.query.mockResolvedValueOnce([]);

    expect(await service.carryInto('u1', target)).toBe(0);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('only looks at closed seasons other than the live one', async () => {
    await service.carryInto('u1', target);

    const [sql, params] = dataSource.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(`s."status" = 'closed'`);
    expect(sql).toContain('"opalsCarriedAt" IS NULL');
    expect(params).toEqual(['u1', 's2']);
  });

  it('claims with the bought-opals-spent-last rule', async () => {
    await service.carryInto('u1', target);

    const claim = manager.query.mock.calls.find(([sql]) =>
      String(sql).includes('SET "opalsCarriedAt" = now()'),
    ) as [string, unknown[]];
    expect(claim[0]).toContain('LEAST("coins", "paidOpals")');
    expect(claim[0]).toContain('"opalsCarriedAt" IS NULL');
  });

  it('moves the amount out of the old balance and into the new one', async () => {
    expect(await service.carryInto('u1', target)).toBe(60);

    expect(economy.move).toHaveBeenCalledWith(
      ['e-old'],
      {
        coins: -60,
        reason: 'opal_carry',
        refType: 'enrolment',
        refId: 'e-new',
      },
      manager,
    );
    expect(economy.move).toHaveBeenCalledWith(
      ['e-new'],
      {
        coins: 60,
        reason: 'opal_carry',
        refType: 'enrolment',
        refId: 'e-old',
      },
      manager,
    );
  });

  it('keeps carried opals marked as bought, so they can carry again', async () => {
    await service.carryInto('u1', target);

    const bump = manager.query.mock.calls.find(([sql]) =>
      String(sql).includes('"paidOpals" = "paidOpals" + $2'),
    ) as [string, unknown[]];
    expect(bump[1]).toEqual(['e-new', 60]);
  });

  it('carries nothing a second time once the source is claimed', async () => {
    claimable = { 'e-old': null };

    expect(await service.carryInto('u1', target)).toBe(0);
    expect(economy.move).not.toHaveBeenCalled();
  });

  it('marks a source carried even when everything bought was spent', async () => {
    claimable = { 'e-old': 0 };

    expect(await service.carryInto('u1', target)).toBe(0);
    expect(economy.move).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('SET "opalsCarriedAt" = now()'),
      ['e-old'],
    );
  });

  it('adds up several closed seasons', async () => {
    dataSource.query.mockResolvedValueOnce([{ id: 'e-a' }, { id: 'e-b' }]);
    claimable = { 'e-a': 30, 'e-b': 45 };

    expect(await service.carryInto('u1', target)).toBe(75);
    expect(economy.move).toHaveBeenCalledTimes(4);
  });
});
