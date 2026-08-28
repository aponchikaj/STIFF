import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { authorChart } from './author-chart';
import { DIFFICULTIES, type Difficulty } from './types';

/**
 * These charts are the fixtures the engine is measured against, so the
 * invariants they claim have to actually hold — an off-grid or over-dense
 * fixture shows up later as a scoring bug that isn't one.
 */
describe('authorChart', () => {
  const BPM = 120;
  const DURATION = 60_000;

  /**
   * A range, not one tempo. The first version of this suite tested 120 BPM
   * only and passed while `normal` at 174 BPM was 27% over its NPS cap — the
   * subdivision has to be derived from tempo, and a single-tempo test cannot
   * see that.
   */
  const TEMPOS = [90, 120, 140, 174, 200];

  const caps: Record<Difficulty, { nps: number; gap: number }> = {
    easy: { nps: 3.0, gap: 200 },
    normal: { nps: 5.5, gap: 130 },
    hard: { nps: 9.0, gap: 90 },
    extreme: { nps: 14.0, gap: 65 },
  };

  for (const difficulty of DIFFICULTIES) {
    test(`${difficulty} respects its NPS cap at every tempo`, () => {
      for (const bpm of TEMPOS) {
        const { npsPeak } = authorChart(difficulty, bpm, DURATION);
        assert.ok(
          npsPeak <= caps[difficulty].nps,
          `${difficulty} at ${bpm}bpm peaked at ${npsPeak}`,
        );
      }
    });

    test(`${difficulty} still produces notes at every tempo`, () => {
      for (const bpm of TEMPOS) {
        assert.ok(authorChart(difficulty, bpm, DURATION).notes.length > 0);
      }
    });

    test(`${difficulty} respects its player-side gap floor`, () => {
      for (const bpm of TEMPOS) {
        const { notes } = authorChart(difficulty, bpm, DURATION);
        const player = notes.filter((n) => n.side === 'player');
        // Simultaneous notes are a jump, not a gap violation, so only distinct
        // timestamps are compared.
        const times = [...new Set(player.map((n) => n.t))].sort((a, b) => a - b);
        for (let i = 1; i < times.length; i++) {
          const gap = (times[i] ?? 0) - (times[i - 1] ?? 0);
          assert.ok(
            gap >= caps[difficulty].gap,
            `${difficulty} at ${bpm}bpm had a ${gap}ms gap`,
          );
        }
      }
    });
  }

  test('easy contains no jumps and no jacks', () => {
    const { notes } = authorChart('easy', BPM, DURATION);

    const byTime = new Map<number, number>();
    for (const n of notes) byTime.set(n.t, (byTime.get(n.t) ?? 0) + 1);
    assert.ok([...byTime.values()].every((count) => count === 1));

    // A jack is the same lane twice in a row on the same side.
    for (const side of ['player', 'opponent'] as const) {
      const lanes = notes.filter((n) => n.side === side).map((n) => n.lane);
      for (let i = 1; i < lanes.length; i++) {
        assert.notEqual(lanes[i], lanes[i - 1]);
      }
    }
  });

  test('extreme places quads on the drop', () => {
    const { notes } = authorChart('extreme', BPM, DURATION);
    const byTime = new Map<number, number>();
    for (const n of notes) byTime.set(n.t, (byTime.get(n.t) ?? 0) + 1);
    assert.ok([...byTime.values()].some((count) => count === 4));
  });

  test('every note lands on an exact integer millisecond', () => {
    // The whole point of a metronomic fixture: expected scores are arithmetic,
    // which only works if note times are exact.
    for (const difficulty of DIFFICULTIES) {
      for (const n of authorChart(difficulty, BPM, DURATION).notes) {
        assert.ok(Number.isInteger(n.t));
      }
    }
  });

  test('is deterministic — same inputs, identical notes', () => {
    assert.deepEqual(
      authorChart('hard', 174, 90_000).notes,
      authorChart('hard', 174, 90_000).notes,
    );
  });

  test('stays inside the song', () => {
    const { notes } = authorChart('extreme', BPM, DURATION);
    assert.ok(Math.max(...notes.map((n) => n.t)) < DURATION);
  });
});
