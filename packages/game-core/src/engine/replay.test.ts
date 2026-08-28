import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { CHART_VERSION, type Chart, type Lane, type Note } from '../chart/types';
import { DEFAULT_JUDGEMENTS } from '../scoring/judgement';
import { HEALTH_START, HOLD_TICK_SCORE } from '../scoring/score-state';
import { replay, ReplayError } from './replay';
import type { InputEvent } from './input';

/**
 * The headless harness. Feed a synthetic input log, assert an exact score.
 *
 * Every expectation below is arithmetic rather than a recorded snapshot — if
 * the scoring table changes, these should be recomputed by hand, not
 * re-blessed.
 */

function chartOf(notes: Note[]): Chart {
  return {
    version: CHART_VERSION,
    songId: 'song-1',
    difficulty: 'normal',
    bpmChanges: [{ beat: 0, bpm: 120 }],
    scrollSpeed: 2.4,
    notes,
    events: [],
    meta: { generator: 'manual', npsPeak: 0, npsAvg: 0 },
  };
}

/** Player taps on lane 0 every 500ms. */
function metronomeChart(count: number, holdMs = 0): Chart {
  const notes: Note[] = [];
  for (let i = 0; i < count; i++) {
    notes.push({
      t: 1000 + i * 500,
      lane: 0,
      side: 'player',
      ...(holdMs ? { holdMs } : {}),
    });
  }
  return chartOf(notes);
}

function press(tMs: number, lane: Lane = 0): InputEvent {
  return { tMs, lane, type: 'press' };
}
function release(tMs: number, lane: Lane = 0): InputEvent {
  return { tMs, lane, type: 'release' };
}

describe('replay — exact scores', () => {
  test('a perfect run scores every note as Sick', () => {
    const chart = metronomeChart(10);
    const inputs = chart.notes.map((n) => press(n.t));

    const result = replay(chart, inputs);

    assert.equal(result.counts.sick, 10);
    assert.equal(result.counts.miss, 0);
    assert.equal(result.score, 10 * DEFAULT_JUDGEMENTS.sick.score);
    assert.equal(result.accuracy, 100);
    assert.equal(result.rank, 'P');
    assert.equal(result.maxCombo, 10);
  });

  test('doing nothing misses everything', () => {
    const chart = metronomeChart(10);
    const result = replay(chart, []);

    assert.equal(result.counts.miss, 10);
    assert.equal(result.score, 10 * DEFAULT_JUDGEMENTS.miss.score);
    assert.equal(result.accuracy, 0);
    assert.equal(result.maxCombo, 0);
  });

  test('failure happens on the eleventh miss, not the tenth', () => {
    // Health starts at 50% and a miss costs 4.75%, so ten misses leave 2.5%
    // and eleven end the run. Worth pinning as arithmetic: it is the number
    // that decides how forgiving the game feels, and it should move only
    // because someone chose to move it.
    assert.equal(replay(metronomeChart(10), []).failed, false);
    assert.equal(replay(metronomeChart(11), []).failed, true);
  });

  test('each window boundary earns exactly its judgement', () => {
    // One note, hit at the far edge of each window in turn.
    const cases = [
      { offset: 45, expect: 'sick' as const },
      { offset: 46, expect: 'good' as const },
      { offset: 90, expect: 'good' as const },
      { offset: 91, expect: 'bad' as const },
      { offset: 135, expect: 'bad' as const },
      { offset: 136, expect: 'shit' as const },
      { offset: 160, expect: 'shit' as const },
      { offset: 161, expect: 'miss' as const },
    ];

    for (const { offset, expect } of cases) {
      const chart = metronomeChart(1);
      const noteT = chart.notes[0]!.t;
      const result = replay(chart, [press(noteT + offset)]);
      assert.equal(
        result.counts[expect],
        1,
        `+${offset}ms should be ${expect}, got ${JSON.stringify(result.counts)}`,
      );
    }
  });

  test('early and late are judged identically', () => {
    const chart = metronomeChart(1);
    const noteT = chart.notes[0]!.t;
    const early = replay(chart, [press(noteT - 70)]);
    const late = replay(chart, [press(noteT + 70)]);
    assert.equal(early.score, late.score);
    assert.deepEqual(early.counts, late.counts);
    // The sign survives into the deltas, which anti-cheat needs.
    assert.deepEqual(early.deltas, [-70]);
    assert.deepEqual(late.deltas, [70]);
  });

  test('combo breaks on Bad but not on Good', () => {
    const chart = metronomeChart(4);
    const [a, b, c, d] = chart.notes as [Note, Note, Note, Note];
    const good = replay(chart, [
      press(a.t),
      press(b.t + 80), // good
      press(c.t),
      press(d.t),
    ]);
    assert.equal(good.maxCombo, 4);

    const bad = replay(chart, [
      press(a.t),
      press(b.t + 100), // bad — breaks
      press(c.t),
      press(d.t),
    ]);
    assert.equal(bad.maxCombo, 2);
  });

  test('accuracy is the weighted mean, computed once', () => {
    // Two Sicks (100) and two Goods (75) => 87.5%.
    const chart = metronomeChart(4);
    const [a, b, c, d] = chart.notes as [Note, Note, Note, Note];
    const result = replay(chart, [
      press(a.t),
      press(b.t),
      press(c.t + 80),
      press(d.t + 80),
    ]);
    assert.equal(result.accuracy, 87.5);
    assert.equal(result.rank, 'B');
  });
});

describe('replay — hold notes', () => {
  test('a fully held note pays one tick per 100ms', () => {
    const chart = metronomeChart(1, 500);
    const noteT = chart.notes[0]!.t;
    const result = replay(chart, [press(noteT), release(noteT + 500)]);

    // Ticks at +100..+500 from the note time: five of them.
    assert.equal(result.holdTicks, 5);
    assert.equal(
      result.score,
      DEFAULT_JUDGEMENTS.sick.score + 5 * HOLD_TICK_SCORE,
    );
  });

  test('releasing early keeps only the ticks already earned', () => {
    const chart = metronomeChart(1, 500);
    const noteT = chart.notes[0]!.t;
    const result = replay(chart, [press(noteT), release(noteT + 250)]);
    assert.equal(result.holdTicks, 2);
  });

  test('hold ticks do not inflate accuracy', () => {
    // A single note held forever must not reach a better rank than the tap
    // itself earned.
    const chart = metronomeChart(1, 5000);
    const noteT = chart.notes[0]!.t;
    const result = replay(chart, [press(noteT + 80), release(noteT + 5000)]);
    assert.equal(result.accuracy, 75);
    assert.ok(result.holdTicks > 0);
  });

  test('ticks are counted from the note, not from when it was hit', () => {
    const chart = metronomeChart(1, 400);
    const noteT = chart.notes[0]!.t;
    const onTime = replay(chart, [press(noteT), release(noteT + 400)]);
    const late = replay(chart, [press(noteT + 40), release(noteT + 400)]);
    assert.equal(onTime.holdTicks, late.holdTicks);
  });
});

describe('replay — determinism', () => {
  test('same chart and log produce a bit-identical result', () => {
    const chart = metronomeChart(200);
    const inputs = chart.notes.map((n, i) => press(n.t + (i % 7) - 3));

    const a = replay(chart, inputs);
    const b = replay(chart, inputs);
    assert.deepEqual(a, b);
  });

  test('a run is unaffected by how finely the clock is stepped', () => {
    // The property the whole anti-cheat design rests on: the client stepping
    // at 60fps and the server stepping at its own rate must agree.
    const chart = metronomeChart(50, 300);
    const inputs = chart.notes.flatMap((n) => [press(n.t), release(n.t + 300)]);

    const short = replay(chart, inputs, { songDurationMs: 30_000 });
    const long = replay(chart, inputs, { songDurationMs: 60_000 });
    assert.equal(short.score, long.score);
    assert.equal(short.accuracy, long.accuracy);
    assert.equal(short.holdTicks, long.holdTicks);
  });

  test('score is independent of note order in the chart', () => {
    const forward = metronomeChart(20);
    const shuffled = chartOf([...forward.notes].reverse());
    const inputs = forward.notes.map((n) => press(n.t));
    assert.equal(replay(forward, inputs).score, replay(shuffled, inputs).score);
  });
});

describe('replay — rejection', () => {
  test('an out-of-order log is refused', () => {
    const chart = metronomeChart(2);
    assert.throws(
      () => replay(chart, [press(2000), press(1000)]),
      ReplayError,
    );
  });

  test('a fractional timestamp is refused', () => {
    const chart = metronomeChart(1);
    assert.throws(() => replay(chart, [press(1000.5)]), ReplayError);
  });
});

describe('replay — health and failure', () => {
  test('no-fail mode survives a run that would otherwise end', () => {
    const chart = metronomeChart(20);
    const result = replay(chart, [], { noFail: true });
    assert.equal(result.failed, false);
    assert.equal(result.counts.miss, 20);
  });

  test('a clean run cannot fail', () => {
    const chart = metronomeChart(30);
    const result = replay(chart, chart.notes.map((n) => press(n.t)));
    assert.equal(result.failed, false);
  });

  test('health starts at half a bar', () => {
    // Two misses is -9.5%, which from 50% must not be fatal.
    const chart = metronomeChart(2);
    const result = replay(chart, []);
    assert.equal(result.failed, false);
    assert.ok(HEALTH_START > 0);
  });
});

describe('replay — opponent notes', () => {
  test('the opponent side is never judged and never missed', () => {
    const chart = chartOf([
      { t: 1000, lane: 0, side: 'opponent' },
      { t: 1500, lane: 1, side: 'opponent' },
      { t: 2000, lane: 2, side: 'player' },
    ]);
    const result = replay(chart, [press(2000, 2)]);
    assert.equal(result.counts.sick, 1);
    assert.equal(result.counts.miss, 0);
    assert.equal(result.accuracy, 100);
  });
});
