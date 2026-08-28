import { DIFFICULTIES, type Difficulty } from '@stiff/game-core';
import { authorChart } from './author-chart';

/**
 * These charts are the fixtures the engine harness will be measured against in
 * Phase 3, so the invariants they claim have to actually hold — an off-grid or
 * over-dense fixture would show up later as a scoring bug that isn't one.
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

  it.each(DIFFICULTIES)('%s produces notes', (difficulty) => {
    const { notes } = authorChart(difficulty, BPM, DURATION);
    expect(notes.length).toBeGreaterThan(0);
  });

  it.each(DIFFICULTIES)(
    '%s respects its NPS cap at every tempo',
    (difficulty) => {
      for (const bpm of TEMPOS) {
        const { npsPeak } = authorChart(difficulty, bpm, DURATION);
        expect({ bpm, npsPeak }).toMatchObject({
          npsPeak: expect.any(Number) as number,
        });
        expect(npsPeak).toBeLessThanOrEqual(caps[difficulty].nps);
      }
    },
  );

  it.each(DIFFICULTIES)(
    '%s still produces notes at every tempo',
    (difficulty) => {
      for (const bpm of TEMPOS) {
        const { notes } = authorChart(difficulty, bpm, DURATION);
        expect(notes.length).toBeGreaterThan(0);
      }
    },
  );

  it.each(DIFFICULTIES)(
    '%s respects its player-side gap floor',
    (difficulty) => {
      for (const bpm of TEMPOS) assertGapFloor(difficulty, bpm);
    },
  );

  function assertGapFloor(difficulty: Difficulty, bpm: number) {
    const { notes } = authorChart(difficulty, bpm, DURATION);
    const player = notes.filter((n) => n.side === 'player');
    // Simultaneous notes are a jump, not a gap violation, so compare distinct
    // timestamps only.
    const times = [...new Set(player.map((n) => n.t))].sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(
        caps[difficulty].gap,
      );
    }
  }

  it('easy contains no jumps and no jacks', () => {
    const { notes } = authorChart('easy', BPM, DURATION);
    const byTime = new Map<number, number>();
    for (const n of notes) byTime.set(n.t, (byTime.get(n.t) ?? 0) + 1);
    expect([...byTime.values()].every((c) => c === 1)).toBe(true);

    // A jack is the same lane twice in a row on the same side.
    for (const side of ['player', 'opponent'] as const) {
      const lanes = notes.filter((n) => n.side === side).map((n) => n.lane);
      for (let i = 1; i < lanes.length; i++) {
        expect(lanes[i]).not.toBe(lanes[i - 1]);
      }
    }
  });

  it('extreme places quads on the drop', () => {
    const { notes } = authorChart('extreme', BPM, DURATION);
    const byTime = new Map<number, number>();
    for (const n of notes) byTime.set(n.t, (byTime.get(n.t) ?? 0) + 1);
    expect([...byTime.values()].some((c) => c === 4)).toBe(true);
  });

  it('every note lands on an exact integer millisecond', () => {
    // The whole point of a metronomic fixture: the harness computes expected
    // scores arithmetically, which only works if note times are exact.
    for (const difficulty of DIFFICULTIES) {
      const { notes } = authorChart(difficulty, BPM, DURATION);
      for (const n of notes) expect(Number.isInteger(n.t)).toBe(true);
    }
  });

  it('is deterministic — same inputs, identical notes', () => {
    const a = authorChart('hard', 174, 90_000);
    const b = authorChart('hard', 174, 90_000);
    expect(a.notes).toEqual(b.notes);
  });

  it('stays inside the song', () => {
    const { notes } = authorChart('extreme', BPM, DURATION);
    expect(Math.max(...notes.map((n) => n.t))).toBeLessThan(DURATION);
  });
});
