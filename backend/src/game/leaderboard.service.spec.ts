import type { EntityManager, Repository } from 'typeorm';
import type { LeaderboardEntry } from './entities/leaderboard-entry.entity';
import type { Run } from './entities/run.entity';
import { LeaderboardService } from './leaderboard.service';

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-2',
    userId: 'user-1',
    chartId: 'chart-1',
    score: 5_000,
    accuracy: 92,
    maxCombo: 100,
    rank: 'A',
    validated: true,
    practiceMode: false,
    createdAt: new Date('2026-08-28T12:00:00Z'),
    ...overrides,
  } as Run;
}

function harness(existing: Partial<LeaderboardEntry> | null) {
  const saved: Partial<LeaderboardEntry>[] = [];
  const manager = {
    findOne: () => Promise.resolve(existing),
    create: (_entity: unknown, value: Partial<LeaderboardEntry>) => value,
    save: (value: Partial<LeaderboardEntry>) => {
      saved.push(value);
      return Promise.resolve(value);
    },
  } as unknown as EntityManager;

  return {
    service: new LeaderboardService({} as Repository<LeaderboardEntry>),
    manager,
    saved,
  };
}

describe('LeaderboardService.recordIfBest', () => {
  it('records a first run', async () => {
    const h = harness(null);
    expect(await h.service.recordIfBest(h.manager, run())).toBe(true);
    expect(h.saved[0]).toMatchObject({ score: 5_000, userId: 'user-1' });
  });

  it('replaces a worse personal best', async () => {
    const h = harness({ score: 4_000, accuracy: 88, removedAt: null });
    expect(await h.service.recordIfBest(h.manager, run())).toBe(true);
    expect(h.saved[0]?.score).toBe(5_000);
  });

  it('leaves a better personal best alone', async () => {
    const h = harness({ score: 9_000, accuracy: 99, removedAt: null });
    expect(await h.service.recordIfBest(h.manager, run())).toBe(false);
    expect(h.saved).toHaveLength(0);
  });

  it('breaks a score tie on accuracy', async () => {
    // Two runs can reach the same score with different note counts; the
    // cleaner one should win.
    const h = harness({ score: 5_000, accuracy: 90, removedAt: null });
    expect(await h.service.recordIfBest(h.manager, run({ accuracy: 92 }))).toBe(
      true,
    );
  });

  it('does not replace on an equal score and equal accuracy', async () => {
    const h = harness({ score: 5_000, accuracy: 92, removedAt: null });
    expect(await h.service.recordIfBest(h.manager, run())).toBe(false);
  });

  it('clears a removal when a genuinely better run arrives', async () => {
    // An admin took down the old entry. The new run is a different run, and
    // holding it responsible for the old one would be a silent shadow-ban.
    const h = harness({
      score: 100,
      accuracy: 10,
      removedAt: new Date(),
      removedBy: 'admin-1',
      removalReason: 'macro use',
    });

    expect(await h.service.recordIfBest(h.manager, run())).toBe(true);
    expect(h.saved[0]).toMatchObject({
      removedAt: null,
      removedBy: null,
      removalReason: null,
    });
  });
});
