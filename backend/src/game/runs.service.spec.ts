import { BadRequestException } from '@nestjs/common';
import {
  compressInputLog,
  hashChart,
  replay,
  toBase64,
  type Chart as ChartData,
  type InputEvent,
  type Lane,
  type Note,
} from '@stiff/game-core';
import type { DataSource, Repository } from 'typeorm';
import type { Chart } from './entities/chart.entity';
import type { Run } from './entities/run.entity';
import type { RunRejection } from './entities/run-rejection.entity';
import type { RunToken } from './entities/run-token.entity';
import { DEFAULT_PAYOUT, type EconomyService } from './economy.service';
import type { LeaderboardService } from './leaderboard.service';
import { looksAutomated, RunsService } from './runs.service';

/**
 * The submission path is the only thing standing between a modified client and
 * the leaderboard, so every way it can say no is pinned here.
 */

const SONG_DURATION_MS = 30_000;
const CHART_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

function notes(): Note[] {
  const out: Note[] = [];
  for (let i = 0; i < 40; i++) {
    out.push({ t: 1000 + i * 500, lane: (i % 4) as Lane, side: 'player' });
  }
  return out;
}

function chartRow(): Chart {
  return {
    id: CHART_ID,
    songId: 'song-1',
    difficulty: 'normal',
    version: 1,
    notes: notes(),
    events: [],
    bpmChanges: [{ beat: 0, bpm: 120 }],
    scrollSpeed: 2.4,
    chartHash: '',
    status: 'approved',
    generatedBy: 'manual',
    npsPeak: 2,
    npsAvg: 1.3,
    song: { durationMs: SONG_DURATION_MS },
  } as unknown as Chart;
}

function chartData(chart: Chart): ChartData {
  return {
    version: 1,
    songId: chart.songId,
    difficulty: chart.difficulty,
    bpmChanges: chart.bpmChanges,
    scrollSpeed: chart.scrollSpeed,
    notes: chart.notes,
    events: chart.events,
    meta: { generator: 'manual', npsPeak: chart.npsPeak, npsAvg: chart.npsAvg },
  };
}

/** Presses each note with a human-looking spread, deterministically. */
function humanLog(chart: Chart, spread = 17): InputEvent[] {
  return chart.notes.map((note, i) => ({
    tMs: note.t + ((i * 13) % (spread * 2)) - spread,
    lane: note.lane,
    type: 'press' as const,
  }));
}

interface Harness {
  service: RunsService;
  chart: Chart;
  token: RunToken;
  saved: Run[];
  rejections: Partial<RunRejection>[];
  minted: number[];
}

async function harness(overrides: Partial<RunToken> = {}): Promise<Harness> {
  const chart = chartRow();
  chart.chartHash = await hashChart(chartData(chart));

  const token: RunToken = {
    id: TOKEN_ID,
    userId: USER_ID,
    chartId: CHART_ID,
    chartHash: chart.chartHash,
    practiceMode: false,
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    ...overrides,
  } as RunToken;

  const saved: Run[] = [];
  const rejections: Partial<RunRejection>[] = [];
  const minted: number[] = [];

  const charts = {
    findOne: () => Promise.resolve(chart),
  } as unknown as Repository<Chart>;

  const tokens = {
    findOne: () => Promise.resolve(token),
  } as unknown as Repository<RunToken>;

  const runs = {} as Repository<Run>;

  const rejectionRepo = {
    create: (value: Partial<RunRejection>) => value,
    save: (value: Partial<RunRejection>) => {
      rejections.push(value);
      return Promise.resolve(value);
    },
  } as unknown as Repository<RunRejection>;

  const manager = {
    createQueryBuilder: () => ({
      update: () => ({
        set: () => ({
          where: () => ({
            execute: () =>
              Promise.resolve({ affected: token.consumedAt ? 0 : 1 }),
          }),
        }),
      }),
    }),
    create: (_entity: unknown, value: Partial<Run>) => value as Run,
    save: (value: Run) => {
      saved.push(value);
      return Promise.resolve(value);
    },
  };

  const dataSource = {
    transaction: (fn: (m: typeof manager) => Promise<Run>) => fn(manager),
  } as unknown as DataSource;

  // Minting and the board are exercised by their own suites; here they only
  // need to be called correctly and have their answers passed through.
  const economy = {
    payoutConfig: () => Promise.resolve(DEFAULT_PAYOUT),
    clearsToday: () => Promise.resolve(0),
    earnedToday: () => Promise.resolve(0),
    balance: () => Promise.resolve(123),
    mintForRun: (_m: unknown, r: Run) => {
      const coins = r.practiceMode || !r.validated ? 0 : 75;
      minted.push(coins);
      return Promise.resolve({
        coins,
        reason: coins > 0 ? 'paid' : 'practice',
      });
    },
  } as unknown as EconomyService;

  const leaderboard = {
    recordIfBest: () => Promise.resolve(true),
  } as unknown as LeaderboardService;

  return {
    service: new RunsService(
      charts,
      tokens,
      runs,
      rejectionRepo,
      dataSource,
      economy,
      leaderboard,
    ),
    chart,
    token,
    saved,
    rejections,
    minted,
  };
}

async function submission(chart: Chart, events: InputEvent[]) {
  const result = replay(chartData(chart), events, {
    songDurationMs: SONG_DURATION_MS,
  });
  return {
    runToken: TOKEN_ID,
    inputLog: toBase64(await compressInputLog(events)),
    clientScore: result.score,
    elapsedMs: SONG_DURATION_MS,
    expected: result,
  };
}

describe('RunsService.submit', () => {
  it('accepts an honest run and stores the server score', async () => {
    const h = await harness();
    const body = await submission(h.chart, humanLog(h.chart));

    const run = await h.service.submit(USER_ID, body);

    expect(run.score).toBe(body.expected.score);
    expect(run.accuracy).toBe(body.expected.accuracy);
    expect(run.validated).toBe(true);
    expect(h.rejections).toHaveLength(0);

    // The results screen shows what the run earned, so submission returns it.
    expect(run.coinsAwarded).toBe(75);
    expect(run.isPersonalBest).toBe(true);
    expect(run.balance).toBe(123);
  });

  it('rejects a score the client made up', async () => {
    const h = await harness();
    const body = await submission(h.chart, humanLog(h.chart));

    await expect(
      h.service.submit(USER_ID, { ...body, clientScore: 999_999 }),
    ).rejects.toThrow(BadRequestException);
    expect(h.rejections[0]?.reason).toBe('score_mismatch');
  });

  it('rejects a run submitted faster than the song is long', async () => {
    const h = await harness();
    const body = await submission(h.chart, humanLog(h.chart));

    await expect(
      h.service.submit(USER_ID, { ...body, elapsedMs: 5_000 }),
    ).rejects.toThrow(BadRequestException);
    expect(h.rejections[0]?.reason).toBe('too_fast');
  });

  it('rejects a token that has already been spent', async () => {
    const h = await harness({ consumedAt: new Date() });
    const body = await submission(h.chart, humanLog(h.chart));

    await expect(h.service.submit(USER_ID, body)).rejects.toThrow(
      BadRequestException,
    );
    expect(h.rejections[0]?.reason).toBe('token_reused');
  });

  it('rejects an expired token', async () => {
    const h = await harness({ expiresAt: new Date(Date.now() - 1) });
    const body = await submission(h.chart, humanLog(h.chart));

    await expect(h.service.submit(USER_ID, body)).rejects.toThrow(
      BadRequestException,
    );
    expect(h.rejections[0]?.reason).toBe('token_expired');
  });

  it("rejects another player's token", async () => {
    const h = await harness();
    const body = await submission(h.chart, humanLog(h.chart));

    await expect(
      h.service.submit('44444444-4444-4444-8444-444444444444', body),
    ).rejects.toThrow(BadRequestException);
    expect(h.rejections[0]?.reason).toBe('token_unknown');
  });

  it('rejects a run whose chart changed underneath it', async () => {
    // The token pinned a hash; the chart has since been edited. Scoring this
    // against notes the player never saw would be worse than refusing it.
    const h = await harness({ chartHash: 'a'.repeat(64) });
    const body = await submission(h.chart, humanLog(h.chart));

    await expect(h.service.submit(USER_ID, body)).rejects.toThrow(
      BadRequestException,
    );
    expect(h.rejections[0]?.reason).toBe('chart_hash_mismatch');
  });

  it('rejects an input log that is not a log', async () => {
    const h = await harness();
    const body = await submission(h.chart, humanLog(h.chart));

    await expect(
      h.service.submit(USER_ID, {
        ...body,
        inputLog: toBase64(Uint8Array.from([1, 2, 3])),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(h.rejections[0]?.reason).toBe('malformed_input_log');
  });

  it('flags a run that is too consistent to be a person', async () => {
    const h = await harness();
    // Every note hit within a millisecond. Not a very good player.
    const perfect = h.chart.notes.map((note) => ({
      tMs: note.t,
      lane: note.lane,
      type: 'press' as const,
    }));
    const body = await submission(h.chart, perfect);

    await expect(h.service.submit(USER_ID, body)).rejects.toThrow(
      BadRequestException,
    );
    expect(h.rejections[0]?.reason).toBe('superhuman_consistency');
  });

  it('does not flag a merely excellent human', async () => {
    // Tight but not inhuman: a few milliseconds of spread throughout.
    const h = await harness();
    const body = await submission(h.chart, humanLog(h.chart, 8));

    const run = await h.service.submit(USER_ID, body);
    expect(run.validated).toBe(true);
  });

  it('records every rejection for review rather than acting on it', async () => {
    const h = await harness();
    const body = await submission(h.chart, humanLog(h.chart));

    await expect(
      h.service.submit(USER_ID, { ...body, clientScore: 1 }),
    ).rejects.toThrow();

    // A queue entry, with the evidence attached — no ban, no suspension.
    expect(h.rejections).toHaveLength(1);
    expect(h.rejections[0]?.userId).toBe(USER_ID);
    expect(h.rejections[0]?.detail).toMatchObject({ client: 1 });
  });

  it('never marks a practice run validated', async () => {
    const h = await harness({ practiceMode: true });
    const body = await submission(h.chart, humanLog(h.chart));

    const run = await h.service.submit(USER_ID, body);
    expect(run.practiceMode).toBe(true);
    expect(run.validated).toBe(false);

    // Practice earns nothing and never reaches a board.
    expect(run.coinsAwarded).toBe(0);
    expect(run.isPersonalBest).toBe(false);
  });
});

describe('looksAutomated', () => {
  it('abstains on a sample too small to mean anything', () => {
    expect(looksAutomated([0, 0, 0, 0, 0])).toBe(false);
  });

  it('catches near-zero timing across a full run', () => {
    expect(looksAutomated(Array.from({ length: 200 }, () => 0))).toBe(true);
  });

  it('passes a human spread', () => {
    const human = Array.from({ length: 200 }, (_, i) => ((i * 7) % 41) - 20);
    expect(looksAutomated(human)).toBe(false);
  });

  it('passes a good player who is still not a machine', () => {
    // Half the hits inside 2ms is exceptional and allowed; the threshold is
    // 90% because the cost of a false positive is a wrongly voided run.
    const good = Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? 0 : 9));
    expect(looksAutomated(good)).toBe(false);
  });
});
