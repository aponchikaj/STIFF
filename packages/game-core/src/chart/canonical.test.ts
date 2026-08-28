import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { canonicalizeChart } from './canonical';
import { hashChart } from './hash';
import { CHART_VERSION, type Chart, type Note } from './types';

function chartOf(notes: Note[], overrides: Partial<Chart> = {}): Chart {
  return {
    version: CHART_VERSION,
    songId: 'song-1',
    difficulty: 'normal',
    bpmChanges: [{ beat: 0, bpm: 120 }],
    scrollSpeed: 2.4,
    notes,
    events: [],
    meta: { generator: 'manual', npsPeak: 4, npsAvg: 2 },
    ...overrides,
  };
}

describe('chart hashing', () => {
  test('note order does not change the hash', async () => {
    const a = chartOf([
      { t: 1000, lane: 0, side: 'player' },
      { t: 500, lane: 3, side: 'opponent' },
      { t: 1000, lane: 2, side: 'player' },
    ]);
    const b = chartOf([
      { t: 1000, lane: 2, side: 'player' },
      { t: 1000, lane: 0, side: 'player' },
      { t: 500, lane: 3, side: 'opponent' },
    ]);
    assert.equal(await hashChart(a), await hashChart(b));
  });

  test('omitted optional fields hash the same as their explicit defaults', async () => {
    const implicit = chartOf([{ t: 200, lane: 1, side: 'player' }]);
    const explicit = chartOf([
      { t: 200, lane: 1, side: 'player', holdMs: 0, kind: 'normal' },
    ]);
    assert.equal(await hashChart(implicit), await hashChart(explicit));
  });

  test('a jump is distinguishable from a single note', async () => {
    const single = chartOf([{ t: 200, lane: 1, side: 'player' }]);
    const jump = chartOf([
      { t: 200, lane: 1, side: 'player' },
      { t: 200, lane: 2, side: 'player' },
    ]);
    assert.notEqual(await hashChart(single), await hashChart(jump));
  });

  test('same lane and time on opposite sides are distinct notes', async () => {
    const one = chartOf([{ t: 200, lane: 1, side: 'player' }]);
    const both = chartOf([
      { t: 200, lane: 1, side: 'player' },
      { t: 200, lane: 1, side: 'opponent' },
    ]);
    assert.notEqual(await hashChart(one), await hashChart(both));
  });

  test('changing a note time changes the hash', async () => {
    const a = chartOf([{ t: 200, lane: 1, side: 'player' }]);
    const b = chartOf([{ t: 201, lane: 1, side: 'player' }]);
    assert.notEqual(await hashChart(a), await hashChart(b));
  });

  test('hold length is part of the identity', async () => {
    const tap = chartOf([{ t: 200, lane: 1, side: 'player' }]);
    const hold = chartOf([{ t: 200, lane: 1, side: 'player', holdMs: 400 }]);
    assert.notEqual(await hashChart(tap), await hashChart(hold));
  });

  test('difficulty is part of the identity', async () => {
    const normal = chartOf([{ t: 200, lane: 1, side: 'player' }]);
    const hard = chartOf([{ t: 200, lane: 1, side: 'player' }], {
      difficulty: 'hard',
    });
    assert.notEqual(await hashChart(normal), await hashChart(hard));
  });

  // The next three are the whole reason canonicalization is narrower than the
  // chart: a designer must be able to retune presentation without wiping the
  // leaderboard of everyone who already played it.
  test('camera events do not change the hash', async () => {
    const plain = chartOf([{ t: 200, lane: 1, side: 'player' }]);
    const staged = chartOf([{ t: 200, lane: 1, side: 'player' }], {
      events: [
        { t: 0, type: 'cameraFocus', data: { side: 'opponent' } },
        { t: 900, type: 'cameraZoom', data: { scale: 1.1 } },
      ],
    });
    assert.equal(await hashChart(plain), await hashChart(staged));
  });

  test('scroll speed does not change the hash', async () => {
    const slow = chartOf([{ t: 200, lane: 1, side: 'player' }]);
    const fast = chartOf([{ t: 200, lane: 1, side: 'player' }], {
      scrollSpeed: 4.8,
    });
    assert.equal(await hashChart(slow), await hashChart(fast));
  });

  test('bpm changes and provenance do not change the hash', async () => {
    const a = chartOf([{ t: 200, lane: 1, side: 'player' }]);
    const b = chartOf([{ t: 200, lane: 1, side: 'player' }], {
      bpmChanges: [
        { beat: 0, bpm: 174 },
        { beat: 64, bpm: 87 },
      ],
      meta: {
        generator: 'ai',
        npsPeak: 9,
        npsAvg: 5,
        generatorModel: 'llama-3.3-70b',
        generatorPromptVersion: 'v3',
      },
    });
    assert.equal(await hashChart(a), await hashChart(b));
  });

  test('canonical form is a stable, greppable text encoding', async () => {
    const chart = chartOf([
      { t: 1000, lane: 2, side: 'player', holdMs: 250 },
      { t: 0, lane: 0, side: 'opponent' },
    ]);
    assert.equal(
      canonicalizeChart(chart),
      ['v1|song-1|normal', '0|0|opponent|0|normal', '1000|2|player|250|normal'].join(
        '\n',
      ),
    );
  });

  test('canonicalizing does not mutate the caller chart', () => {
    const notes: Note[] = [
      { t: 1000, lane: 0, side: 'player' },
      { t: 500, lane: 3, side: 'player' },
    ];
    const chart = chartOf(notes);
    canonicalizeChart(chart);
    assert.equal(chart.notes[0]?.t, 1000);
  });
});
