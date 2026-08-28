import type { AnalysisResult, Onset, SectionPlan } from '../analysis/types';
import type { Chart, Difficulty, Lane, Note } from './types';

/**
 * Stage B: onsets to notes.
 *
 * Deterministic and entirely offline. The language model's section plan is an
 * *input* here, not a step — it arrives as a handful of numbers per section and
 * this decides where every note goes. If the plan is missing, the chart is
 * still built; it is just flatter.
 */

export interface DifficultyShape {
  maxNps: number;
  minGapMs: number;
  /** Onsets weaker than this are ignored before anything else happens. */
  strengthFloor: number;
  jumps: boolean;
  jacks: boolean;
  quads: boolean;
}

export const SHAPES: Readonly<Record<Difficulty, DifficultyShape>> = {
  easy: { maxNps: 3.0, minGapMs: 200, strengthFloor: 0.62, jumps: false, jacks: false, quads: false },
  normal: { maxNps: 5.5, minGapMs: 130, strengthFloor: 0.42, jumps: true, jacks: false, quads: false },
  hard: { maxNps: 9.0, minGapMs: 90, strengthFloor: 0.24, jumps: true, jacks: true, quads: false },
  extreme: { maxNps: 14.0, minGapMs: 65, strengthFloor: 0.12, jumps: true, jacks: true, quads: true },
};

/**
 * Which lane an onset goes in, from where its energy sits.
 *
 * Low to the outer lanes, high to the inner ones, with the alternation counter
 * choosing between the pair. That keeps kicks and hats visibly separate while
 * still alternating hands within each — a chart that put every kick in lane 0
 * would be a column, not a pattern.
 */
const BAND_LANES: Record<Onset['band'], [Lane, Lane]> = {
  low: [0, 3],
  mid: [1, 2],
  high: [2, 1],
};

export interface GenerateOptions {
  plan?: SectionPlan;
  scrollSpeed?: number;
}

export function generateChart(
  songId: string,
  difficulty: Difficulty,
  analysis: AnalysisResult,
  options: GenerateOptions = {},
): Chart {
  const shape = SHAPES[difficulty];
  const notes: Note[] = [];

  let alternation = 0;
  let lastPlayerMs = -Infinity;
  let lastLane: Lane | null = null;

  for (const onset of analysis.onsets) {
    const section = sectionFor(analysis, onset.ms);
    const planned = options.plan?.sections.find((s) => s.index === section);

    // The plan scales the threshold rather than adding or removing notes
    // directly: a drop at intensity 1 lets quieter onsets through, an intro at
    // 0.2 keeps only the strongest. The onsets themselves are never invented.
    const intensity = planned?.intensity ?? 0.6;
    const floor = shape.strengthFloor * (1.6 - intensity);
    if (onset.strength < floor) continue;

    const side: Note['side'] =
      planned?.lead === 'opponent' ? 'opponent' : 'player';

    if (side === 'player') {
      if (onset.ms - lastPlayerMs < shape.minGapMs) continue;
      lastPlayerMs = onset.ms;
    }

    const [primary, secondary] = BAND_LANES[onset.band];
    let lane = alternation % 2 === 0 ? primary : secondary;
    alternation++;

    // A jack is the same lane twice running. Easy and normal forbid it, so
    // the note moves to its partner rather than being dropped — the beat is
    // still there to be hit.
    if (!shape.jacks && lane === lastLane) {
      lane = lane === primary ? secondary : primary;
    }
    lastLane = lane;

    notes.push({ t: onset.ms, lane, side });

    const strong = onset.strength > 0.85;
    if (shape.quads && strong && side === 'player') {
      for (const extra of [0, 1, 2, 3] as Lane[]) {
        if (extra !== lane) notes.push({ t: onset.ms, lane: extra, side });
      }
    } else if (shape.jumps && strong && side === 'player') {
      notes.push({ t: onset.ms, lane: ((lane + 2) % 4) as Lane, side });
    }
  }

  const repaired = repairChart(notes, shape);
  const { npsPeak, npsAvg } = measureNps(repaired, analysis.durationMs);

  return {
    version: 1,
    songId,
    difficulty,
    bpmChanges: [{ beat: 0, bpm: analysis.bpm }],
    scrollSpeed: options.scrollSpeed ?? 2.4,
    notes: repaired,
    events: [],
    meta: {
      generator: options.plan ? 'ai' : 'manual',
      npsPeak,
      npsAvg,
    },
  };
}

/**
 * The repair pass.
 *
 * Everything the generator is supposed to respect, enforced again afterwards —
 * because a chart that violates its own difficulty is worse than a sparse one,
 * and because the section plan comes from a model and must not be able to talk
 * the generator into an unplayable chart.
 *
 * Violations are dropped rather than nudged: moving a note changes where the
 * music said it was, and a chart slightly out of time is harder to diagnose
 * than one with a gap in it.
 */
export function repairChart(notes: Note[], shape: DifficultyShape): Note[] {
  const sorted = [...notes].sort((a, b) => a.t - b.t || a.lane - b.lane);

  const seen = new Set<string>();
  const deduped: Note[] = [];
  for (const note of sorted) {
    const key = `${note.t}:${note.lane}:${note.side}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(note);
  }

  /*
   * NPS ceiling, on a rolling one-second window of player notes.
   *
   * Floored, because the caps are fractional and the window holds whole notes.
   * Comparing a count of 5 against a cap of 5.5 lets a sixth note through and
   * produces a 6 NPS window on a 5.5 NPS difficulty — which is exactly what
   * `normal` did on the first real track put through the pipeline. Synthetic
   * click tracks never caught it because their density never landed on the
   * boundary.
   */
  const maxNotesPerWindow = Math.floor(shape.maxNps);
  const kept: Note[] = [];
  const window: number[] = [];

  for (const note of deduped) {
    if (note.side !== 'player') {
      kept.push(note);
      continue;
    }

    while (window.length > 0 && note.t - window[0]! >= 1000) window.shift();
    if (window.length >= maxNotesPerWindow) continue;

    window.push(note.t);
    kept.push(note);
  }

  return kept;
}

export function measureNps(
  notes: Note[],
  durationMs: number,
): { npsPeak: number; npsAvg: number } {
  const played = notes.filter((n) => n.side === 'player');
  if (played.length === 0 || durationMs <= 0) {
    return { npsPeak: 0, npsAvg: 0 };
  }

  let peak = 0;
  let start = 0;
  for (let end = 0; end < played.length; end++) {
    const endNote = played[end]!;
    for (;;) {
      const oldest = played[start];
      if (!oldest || endNote.t - oldest.t < 1000) break;
      start++;
    }
    peak = Math.max(peak, end - start + 1);
  }

  return {
    npsPeak: peak,
    npsAvg: Number((played.length / (durationMs / 1000)).toFixed(3)),
  };
}

function sectionFor(analysis: AnalysisResult, ms: number): number {
  for (const section of analysis.sections) {
    if (ms >= section.startMs && ms < section.endMs) return section.index;
  }
  return analysis.sections.length - 1;
}

/**
 * The invariants a chart must satisfy before it can be persisted as approved.
 *
 * Returns the reasons it cannot be, which is more useful than a boolean when
 * the caller is an admin screen explaining why a generation was rejected.
 */
export function validateChart(chart: Chart, durationMs: number): string[] {
  const shape = SHAPES[chart.difficulty];
  const problems: string[] = [];

  for (let i = 1; i < chart.notes.length; i++) {
    if (chart.notes[i]!.t < chart.notes[i - 1]!.t) {
      problems.push('notes are not sorted by time');
      break;
    }
  }

  const seen = new Set<string>();
  for (const note of chart.notes) {
    const key = `${note.t}:${note.lane}:${note.side}`;
    if (seen.has(key)) {
      problems.push('duplicate note on the same lane and time');
      break;
    }
    seen.add(key);
  }

  if (chart.notes.some((n) => !Number.isInteger(n.t))) {
    problems.push('note times must be whole milliseconds');
  }
  if (chart.notes.some((n) => n.t < 0 || n.t > durationMs)) {
    problems.push('a note falls outside the song');
  }

  const { npsPeak } = measureNps(chart.notes, durationMs);
  if (npsPeak > shape.maxNps) {
    problems.push(
      `peak ${npsPeak} NPS exceeds the ${shape.maxNps} cap for ${chart.difficulty}`,
    );
  }

  const player = chart.notes.filter((n) => n.side === 'player');
  const times = [...new Set(player.map((n) => n.t))].sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    if (times[i]! - times[i - 1]! < shape.minGapMs) {
      problems.push(`a gap under the ${shape.minGapMs}ms floor`);
      break;
    }
  }

  if (chart.notes.length === 0) problems.push('chart is empty');

  return problems;
}
