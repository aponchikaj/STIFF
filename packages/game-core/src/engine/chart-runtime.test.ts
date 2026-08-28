import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { CHART_VERSION, type Chart, type Lane, type Note } from '../chart/types';
import { accuracyPercent } from '../scoring/score-state';
import { ChartRuntime } from './chart-runtime';
import type { InputEvent } from './input';
import { replay } from './replay';

function chartOf(notes: Note[]): Chart {
  return {
    version: CHART_VERSION,
    songId: 'song-1',
    difficulty: 'hard',
    bpmChanges: [{ beat: 0, bpm: 174 }],
    scrollSpeed: 2.4,
    notes,
    events: [],
    meta: { generator: 'manual', npsPeak: 0, npsAvg: 0 },
  };
}

/** A dense chart with jumps and holds — the cases that expose ordering bugs. */
function busyChart(): Chart {
  const notes: Note[] = [];
  for (let i = 0; i < 300; i++) {
    const t = 1000 + i * 120;
    const lane = (i % 4) as Lane;
    notes.push({ t, lane, side: i % 5 === 0 ? 'opponent' : 'player' });
    if (i % 17 === 0) notes.push({ t, lane: ((lane + 2) % 4) as Lane, side: 'player' });
    if (i % 23 === 0) {
      notes.push({ t: t + 60, lane: ((lane + 1) % 4) as Lane, side: 'player', holdMs: 400 });
    }
  }
  return chartOf(notes);
}

/**
 * Presses off each player note by a deterministic spread wide enough to land
 * in every window and past the last one.
 *
 * The spread is the point. A tight ±10ms jitter scores every note Sick, and a
 * run with one judgement in it cannot detect a live-versus-replay
 * disagreement at a window boundary — which is precisely where one would
 * appear. This spread produces sicks, goods, bads, shits and misses.
 */
function humanInputs(chart: Chart): InputEvent[] {
  const events: InputEvent[] = [];
  chart.notes.forEach((note, i) => {
    if (note.side !== 'player') return;
    const jitter = ((i * 61) % 341) - 170; // −170..+170ms, no randomness
    events.push({ tMs: note.t + jitter, lane: note.lane, type: 'press' });
    events.push({
      tMs: note.t + jitter + (note.holdMs ?? 0) + 1,
      lane: note.lane,
      type: 'release',
    });
  });
  return events.sort((a, b) => a.tMs - b.tMs);
}

/**
 * Drives the runtime the way a browser does: irregular frames, inputs
 * delivered at their own timestamps between them.
 */
function playLive(chart: Chart, inputs: InputEvent[], frameMs: number[]) {
  const runtime = new ChartRuntime(chart);
  let cursor = 0;
  let frame = 0;
  let next = 0;

  const endMs = chart.notes.reduce((m, n) => Math.max(m, n.t + (n.holdMs ?? 0)), 0) + 1000;

  while (cursor < endMs) {
    const step = frameMs[frame % frameMs.length] ?? 16;
    frame++;
    const target = cursor + step;

    // Inputs that fall inside this frame are applied at their own time, which
    // is what timestamping against the audio clock buys.
    while (next < inputs.length && inputs[next]!.tMs <= target) {
      const event = inputs[next]!;
      runtime.update(Math.max(cursor, Math.min(event.tMs, target)));
      if (event.type === 'press') runtime.press(event.lane, event.tMs);
      else runtime.release(event.lane, event.tMs);
      next++;
    }

    cursor = target;
    runtime.update(cursor);
  }
  return runtime;
}

describe('ChartRuntime — the live path matches the replayed one', () => {
  test('a jittery 60fps client agrees with the server exactly', () => {
    // This is the property the whole anti-cheat design rests on. If it ever
    // fails, the results screen and the leaderboard disagree in public.
    const chart = busyChart();
    const inputs = humanInputs(chart);

    // Frame times that are not a constant: a real device drops frames.
    const live = playLive(chart, inputs, [16, 17, 16, 33, 16, 16, 50, 16]);
    const server = replay(chart, inputs);

    assert.equal(live.state.score, server.score);
    assert.equal(accuracyPercent(live.state), server.accuracy);
    assert.equal(live.state.maxCombo, server.maxCombo);
    assert.equal(live.state.holdTicks, server.holdTicks);
    assert.deepEqual({ ...live.state.counts }, server.counts);
  });

  test('a badly stuttering client still agrees', () => {
    const chart = busyChart();
    const inputs = humanInputs(chart);

    const smooth = playLive(chart, inputs, [16]);
    const awful = playLive(chart, inputs, [120, 8, 250, 16, 4]);

    assert.equal(smooth.state.score, awful.state.score);
    assert.deepEqual({ ...smooth.state.counts }, { ...awful.state.counts });
  });
});

describe('ChartRuntime — note matching', () => {
  test('a press takes the nearest note, not the earliest', () => {
    // Two notes 100ms apart; a press 10ms before the second is within reach of
    // both. Awarding the first would score a very late hit on A and then miss
    // B as well — one small error becoming two.
    const chart = chartOf([
      { t: 1000, lane: 0, side: 'player' },
      { t: 1100, lane: 0, side: 'player' },
    ]);
    const runtime = new ChartRuntime(chart);
    runtime.update(1090);
    runtime.press(0, 1090);

    const [first, second] = runtime.notes;
    assert.equal(first?.judgement, null);
    assert.equal(second?.judgement, 'sick');
  });

  test('one press cannot resolve two notes', () => {
    const chart = chartOf([
      { t: 1000, lane: 0, side: 'player' },
      { t: 1010, lane: 0, side: 'player' },
    ]);
    const runtime = new ChartRuntime(chart);
    runtime.press(0, 1005);
    const judged = runtime.notes.filter((n) => n.judgement !== null);
    assert.equal(judged.length, 1);
  });

  test('a jump needs both lanes pressed', () => {
    const chart = chartOf([
      { t: 1000, lane: 0, side: 'player' },
      { t: 1000, lane: 2, side: 'player' },
    ]);
    const runtime = new ChartRuntime(chart);
    runtime.press(0, 1000);
    runtime.press(2, 1000);
    runtime.update(1200);
    assert.equal(runtime.state.counts.sick, 2);
    assert.equal(runtime.state.counts.miss, 0);
  });

  test('pressing the wrong lane costs nothing and hits nothing', () => {
    const chart = chartOf([{ t: 1000, lane: 0, side: 'player' }]);
    const runtime = new ChartRuntime(chart);
    const judgement = runtime.press(3, 1000);
    assert.equal(judgement, null);
    assert.equal(runtime.state.score, 0);
    assert.equal(runtime.state.judgedCount, 0);
  });

  test('mashing an empty lane does not build combo', () => {
    const chart = chartOf([{ t: 5000, lane: 0, side: 'player' }]);
    const runtime = new ChartRuntime(chart);
    for (let t = 0; t < 1000; t += 20) runtime.press(1, t);
    assert.equal(runtime.state.combo, 0);
    assert.equal(runtime.state.score, 0);
  });
});

describe('ChartRuntime — bookkeeping', () => {
  test('judgements drain once and only once', () => {
    const chart = chartOf([{ t: 1000, lane: 0, side: 'player' }]);
    const runtime = new ChartRuntime(chart);
    runtime.press(0, 1000);

    assert.equal(runtime.drainJudgements().length, 1);
    assert.equal(runtime.drainJudgements().length, 0);
  });

  test('completion is reached once every player note is resolved', () => {
    const chart = chartOf([
      { t: 1000, lane: 0, side: 'player' },
      { t: 1200, lane: 1, side: 'opponent' },
    ]);
    const runtime = new ChartRuntime(chart);
    assert.equal(runtime.isComplete, false);
    runtime.update(2000);
    assert.equal(runtime.isComplete, true);
  });

  test('rewinding the clock is ignored rather than double-counted', () => {
    const chart = chartOf([{ t: 1000, lane: 0, side: 'player' }]);
    const runtime = new ChartRuntime(chart);
    runtime.update(2000);
    runtime.update(500);
    runtime.update(2000);
    assert.equal(runtime.state.counts.miss, 1);
  });
});
