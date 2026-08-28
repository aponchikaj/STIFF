import type { EntityManager } from 'typeorm';
import { DEFAULT_PAYOUT, EconomyService } from './economy.service';
import type { CoinLedgerEntry } from './entities/coin-ledger.entity';
import type { Rank, Run } from './entities/run.entity';

/**
 * Payout rules, pinned as arithmetic.
 *
 * These decide how much of the game's currency exists, so every number below
 * is computed by hand rather than blessed from a snapshot — if the config
 * changes, these should be recomputed, not re-recorded.
 */

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    userId: 'user-1',
    chartId: 'chart-1',
    rank: 'S',
    validated: true,
    practiceMode: false,
    ...overrides,
  } as Run;
}

function harness() {
  const saved: Partial<CoinLedgerEntry>[] = [];
  const manager = {
    create: (_entity: unknown, value: Partial<CoinLedgerEntry>) => value,
    save: (value: Partial<CoinLedgerEntry>) => {
      saved.push(value);
      return Promise.resolve(value);
    },
  } as unknown as EntityManager;

  const service = new EconomyService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, manager, saved };
}

describe('EconomyService.mintForRun', () => {
  it('pays base x rank multiplier on a first clear', async () => {
    // hard base 60, rank S multiplier 1.25, first clear share 1 => 75.
    const { service, manager, saved } = harness();
    const outcome = await service.mintForRun(
      manager,
      run({ rank: 'S' }),
      'hard',
      DEFAULT_PAYOUT,
      0,
      0,
    );

    expect(outcome).toEqual({ coins: 75, reason: 'paid' });
    expect(saved).toHaveLength(1);
    expect(saved[0]?.delta).toBe(75);
  });

  it('keys the ledger entry on the run so a resubmit cannot double-pay', async () => {
    const { service, manager, saved } = harness();
    await service.mintForRun(manager, run(), 'normal', DEFAULT_PAYOUT, 0, 0);
    expect(saved[0]?.idempotencyKey).toBe('run:run-1');
    expect(saved[0]?.reason).toBe('run_reward');
  });

  it('pays nothing for a practice run', async () => {
    const { service, manager, saved } = harness();
    const outcome = await service.mintForRun(
      manager,
      run({ practiceMode: true, validated: false }),
      'extreme',
      DEFAULT_PAYOUT,
      0,
      0,
    );
    expect(outcome).toEqual({ coins: 0, reason: 'practice' });
    expect(saved).toHaveLength(0);
  });

  it('pays nothing for an unvalidated run', async () => {
    const { service, manager, saved } = harness();
    const outcome = await service.mintForRun(
      manager,
      run({ validated: false }),
      'extreme',
      DEFAULT_PAYOUT,
      0,
      0,
    );
    expect(outcome).toEqual({ coins: 0, reason: 'unvalidated' });
    expect(saved).toHaveLength(0);
  });

  it('pays nothing below a C', async () => {
    const { service, manager } = harness();
    for (const rank of ['D', 'F'] as Rank[]) {
      const outcome = await service.mintForRun(
        manager,
        run({ rank }),
        'hard',
        DEFAULT_PAYOUT,
        0,
        0,
      );
      expect(outcome.reason).toBe('rank_too_low');
    }
  });

  it('tapers a chart played repeatedly in one day', async () => {
    // The curve is [1, 1, 1, 0.5, 0.25, 0.1, 0] against normal (35) at rank A
    // (1.1) => 38.5 full, so 39, 39, 39, 19, 10, 4, then nothing.
    const { service, manager } = harness();
    const paid: number[] = [];
    for (let clears = 0; clears < 7; clears++) {
      const outcome = await service.mintForRun(
        manager,
        run({ rank: 'A' }),
        'normal',
        DEFAULT_PAYOUT,
        clears,
        0,
      );
      paid.push(outcome.coins);
    }
    expect(paid).toEqual([39, 39, 39, 19, 10, 4, 0]);
  });

  it('keeps paying zero past the end of the curve', async () => {
    // Farming for hours must not wrap round to the front of the array.
    const { service, manager } = harness();
    const outcome = await service.mintForRun(
      manager,
      run(),
      'extreme',
      DEFAULT_PAYOUT,
      500,
      0,
    );
    expect(outcome).toEqual({ coins: 0, reason: 'farmed' });
  });

  it('trims the last payout of the day to the cap rather than overshooting', async () => {
    // 1,980 earned, cap 2,000: a 125-coin run pays the remaining 20.
    const { service, manager, saved } = harness();
    const outcome = await service.mintForRun(
      manager,
      run({ rank: 'S' }),
      'extreme',
      DEFAULT_PAYOUT,
      0,
      1_980,
    );
    expect(outcome).toEqual({ coins: 20, reason: 'paid' });
    expect(saved[0]?.delta).toBe(20);
  });

  it('pays nothing once the cap is reached', async () => {
    const { service, manager, saved } = harness();
    const outcome = await service.mintForRun(
      manager,
      run(),
      'extreme',
      DEFAULT_PAYOUT,
      0,
      2_000,
    );
    expect(outcome).toEqual({ coins: 0, reason: 'daily_cap' });
    expect(saved).toHaveLength(0);
  });

  it('never mints a negative amount', async () => {
    // A cap already exceeded — by an admin adjustment, say — must not claw
    // coins back by minting a negative reward.
    const { service, manager, saved } = harness();
    const outcome = await service.mintForRun(
      manager,
      run(),
      'easy',
      DEFAULT_PAYOUT,
      0,
      5_000,
    );
    expect(outcome.coins).toBe(0);
    expect(saved).toHaveLength(0);
  });

  it('scales with difficulty', async () => {
    const { service, manager } = harness();
    const paid: number[] = [];
    for (const difficulty of ['easy', 'normal', 'hard', 'extreme'] as const) {
      const outcome = await service.mintForRun(
        manager,
        run({ rank: 'P' }),
        difficulty,
        DEFAULT_PAYOUT,
        0,
        0,
      );
      paid.push(outcome.coins);
    }
    // 1.5x on 20 / 35 / 60 / 100.
    expect(paid).toEqual([30, 53, 90, 150]);
    expect([...paid].sort((a, b) => a - b)).toEqual(paid);
  });
});
