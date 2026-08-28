import type { Difficulty, Lane, Note } from '@stiff/game-core';

/**
 * Hand-authored charts for the seed fixtures.
 *
 * These are written against a strict beat grid rather than against audio,
 * because the seed songs *are* metronomic test fixtures — see `game-seed.ts`
 * for why there is no third-party music here. Two things follow from that, and
 * both are useful:
 *
 * - Every note lands on an exact, known millisecond. That is precisely what
 *   the Phase 3 headless harness needs: feed it a synthetic input log offset
 *   by a known amount and the expected score is arithmetic, not a guess.
 * - The patterns are musical phrases, not noise. Four-bar structures, a build
 *   and a drop, call-and-response between opponent and player — so the charts
 *   exercise the engine the way a real song will.
 *
 * This is emphatically *not* the Phase 7 deterministic charter. That one reads
 * onset strength and spectral band out of an `AnalysisResult`. This one knows
 * only a tempo.
 */

interface Shape {
  /** Hard ceiling from the brief, asserted after generation. */
  maxNps: number;
  /** Minimum milliseconds between consecutive notes on the player side. */
  minGapMs: number;
  jumps: boolean;
  quads: boolean;
}

const SHAPES: Record<Difficulty, Shape> = {
  easy: { maxNps: 3.0, minGapMs: 200, jumps: false, quads: false },
  normal: { maxNps: 5.5, minGapMs: 130, jumps: true, quads: false },
  hard: { maxNps: 9.0, minGapMs: 90, jumps: true, quads: false },
  extreme: { maxNps: 14.0, minGapMs: 65, jumps: true, quads: true },
};

/**
 * How finely a beat is divided, derived from tempo rather than fixed.
 *
 * This is the thing that is easy to get wrong and only shows up at one end of
 * the tempo range: sixteenths at 120 BPM are 8 notes per second and sit inside
 * `hard`, while the same sixteenths at 174 BPM are 11.6 and do not. So the
 * subdivision is chosen per song, and a fast track gets a coarser grid at the
 * same difficulty — which is what human charters do too.
 *
 * The headroom subtracted is the worst case a single window can gain from
 * chords: one extra note for a jump, three for a quad.
 */
function subdivisionFor(shape: Shape, bpm: number): number {
  const beatsPerSecond = bpm / 60;
  const headroom = (shape.quads ? 3 : 0) + (shape.jumps ? 1 : 0);
  const budget = shape.maxNps - headroom;
  // Below 1 means "a note every N beats" — `easy` at 200 BPM cannot fit under
  // 3 NPS even on every beat, so the grid has to be able to get coarser than
  // the beat itself. All values keep `4 * s` a whole number of steps per bar.
  const candidates = [4, 2, 1, 0.5, 0.25];
  return candidates.find((s) => beatsPerSecond * s <= budget) ?? 0.25;
}

/**
 * Lane order for a run of consecutive notes. Alternates hands rather than
 * walking 0,1,2,3 — a staircase is comfortable, a repeated lane (a "jack") is
 * not, and easy charts must contain none.
 */
const HAND_ALTERNATION: Lane[] = [0, 2, 1, 3, 2, 0, 3, 1];

export interface AuthoredChart {
  notes: Note[];
  npsPeak: number;
  npsAvg: number;
}

export function authorChart(
  difficulty: Difficulty,
  bpm: number,
  durationMs: number,
): AuthoredChart {
  const shape = SHAPES[difficulty];
  const subdivision = subdivisionFor(shape, bpm);
  const beatMs = 60_000 / bpm;
  const stepMs = beatMs / subdivision;
  const totalSteps = Math.floor(durationMs / stepMs);
  const stepsPerBar = 4 * subdivision;

  const notes: Note[] = [];
  let handIndex = 0;
  let lastPlayerMs = -Infinity;

  for (let step = 0; step < totalSteps; step++) {
    const t = Math.round(step * stepMs);
    const bar = Math.floor(step / stepsPerBar);
    const stepInBar = step % stepsPerBar;
    const phrase = Math.floor(bar / 4) % 4; // intro, build, drop, outro

    // Call and response: the opponent leads the first two bars of each phrase.
    const side: Note['side'] = bar % 4 < 2 ? 'opponent' : 'player';

    if (!shouldPlace(difficulty, phrase, stepInBar)) continue;

    if (side === 'player') {
      if (t - lastPlayerMs < shape.minGapMs) continue;
      lastPlayerMs = t;
    }

    const lane = HAND_ALTERNATION[handIndex % HAND_ALTERNATION.length];
    handIndex++;
    notes.push({ t, lane, side });

    // Jumps land on the downbeat of a bar during the drop, quads on the
    // downbeat of the drop's first bar only.
    const onDownbeat = stepInBar === 0;
    if (shape.quads && phrase === 2 && onDownbeat && bar % 4 === 2) {
      for (const extra of [0, 1, 2, 3] as Lane[]) {
        if (extra !== lane) notes.push({ t, lane: extra, side });
      }
    } else if (shape.jumps && phrase === 2 && onDownbeat) {
      const partner = ((lane + 2) % 4) as Lane;
      notes.push({ t, lane: partner, side });
    }
  }

  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  const { npsPeak, npsAvg } = measure(notes, durationMs);

  if (npsPeak > shape.maxNps) {
    throw new Error(
      `authorChart(${difficulty}): peak ${npsPeak.toFixed(2)} NPS exceeds the ` +
        `${shape.maxNps} cap. Fix the pattern, do not raise the cap.`,
    );
  }

  return { notes, npsPeak, npsAvg };
}

/** Which steps within a bar carry a note, by difficulty and phrase. */
function shouldPlace(
  difficulty: Difficulty,
  phrase: number,
  stepInBar: number,
): boolean {
  if (difficulty === 'easy') {
    // Beats 1 and 3 through the intro, all four beats once it builds.
    return phrase === 0 ? stepInBar % 2 === 0 : true;
  }
  if (difficulty === 'normal') {
    // Quarters in the intro, eighths from the build on.
    return phrase === 0 ? stepInBar % 2 === 0 : true;
  }
  if (difficulty === 'hard') {
    // Eighths, thickening to sixteenth runs across the drop.
    if (phrase === 2) return true;
    return stepInBar % 2 === 0;
  }
  // extreme: sixteenth streams through the drop, eighths elsewhere.
  if (phrase === 2 || phrase === 1) return true;
  return stepInBar % 2 === 0;
}

/**
 * Peak is the busiest one-second window; average is over the whole song.
 *
 * Player notes only. Notes-per-second is a measure of what the human has to
 * physically hit, and the opponent's side is watched, not played — counting it
 * would make a call-and-response chart read as twice as hard as it is, and
 * would have the difficulty caps rejecting patterns that are comfortable.
 */
function measure(
  notes: Note[],
  durationMs: number,
): { npsPeak: number; npsAvg: number } {
  const played = notes.filter((n) => n.side === 'player');
  if (played.length === 0) return { npsPeak: 0, npsAvg: 0 };

  let peak = 0;
  let start = 0;
  for (let end = 0; end < played.length; end++) {
    const endNote = played[end];
    if (!endNote) continue;
    // Half-open window: notes exactly 1000ms apart span a full second and are
    // a rate of one per second, not two. Counting both ends reports every
    // pattern as one note per second denser than it is.
    while (played[start] && endNote.t - played[start].t >= 1000) start++;
    peak = Math.max(peak, end - start + 1);
  }

  return {
    npsPeak: peak,
    npsAvg: Number((played.length / (durationMs / 1000)).toFixed(3)),
  };
}
