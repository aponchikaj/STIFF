/**
 * The chart format, version 1.
 *
 * Deliberately not the FNF `.fnfc` format. That one carries a step/beat model
 * and a section list that only make sense alongside its engine; ours stores
 * absolute integer milliseconds so that judging a hit never depends on
 * reconstructing a beat grid at runtime. Tempo lives in `bpmChanges` for the
 * editor and the visuals, and nothing in the scorer reads it.
 */

export const CHART_VERSION = 1;

export type Difficulty = 'easy' | 'normal' | 'hard' | 'extreme';

export const DIFFICULTIES: readonly Difficulty[] = [
  'easy',
  'normal',
  'hard',
  'extreme',
];

/** left, down, up, right. */
export type Lane = 0 | 1 | 2 | 3;

export const LANES: readonly Lane[] = [0, 1, 2, 3];

export type Side = 'player' | 'opponent';

/**
 * Extensible, but every kind must be understood by the scorer — an unknown
 * kind is a validation failure rather than something to ignore, or a chart
 * could quietly score differently on a client that predates the kind.
 */
export type NoteKind = 'normal' | 'mine' | 'noScore';

export const NOTE_KINDS: readonly NoteKind[] = ['normal', 'mine', 'noScore'];

export interface Note {
  /** Integer milliseconds from song start. Never fractional. */
  t: number;
  lane: Lane;
  side: Side;
  /** Integer milliseconds. Absent or 0 means a tap. */
  holdMs?: number;
  /** Absent means 'normal'. */
  kind?: NoteKind;
}

export interface BpmChange {
  /** Beat index from song start; may be fractional. */
  beat: number;
  bpm: number;
}

/**
 * Presentation only. Camera and stage triggers never reach the scorer, which
 * is why they are excluded from the chart hash — see `canonicalizeChart`.
 */
export interface ChartEvent {
  /** Integer milliseconds from song start. */
  t: number;
  type: 'cameraFocus' | 'cameraZoom' | 'stageTrigger';
  /** Shape depends on `type`; validated per-type at the schema layer. */
  data?: Record<string, string | number | boolean>;
}

export interface ChartMeta {
  generator: 'ai' | 'manual' | 'imported';
  /** Peak notes-per-second over a one-second sliding window. */
  npsPeak: number;
  npsAvg: number;
  /** Set when `generator` is 'ai', so a bad batch can be traced to a model. */
  generatorModel?: string;
  generatorPromptVersion?: string;
}

export interface Chart {
  version: typeof CHART_VERSION;
  songId: string;
  difficulty: Difficulty;
  bpmChanges: BpmChange[];
  /** Default scroll speed. A player may override it, so it is not hashed. */
  scrollSpeed: number;
  /** Sorted by `t`, then `lane`, then `side`. */
  notes: Note[];
  events: ChartEvent[];
  meta: ChartMeta;
}

/** A note with its optional fields resolved — what the scorer actually reads. */
export interface ResolvedNote {
  t: number;
  lane: Lane;
  side: Side;
  holdMs: number;
  kind: NoteKind;
}

export function resolveNote(note: Note): ResolvedNote {
  return {
    t: note.t,
    lane: note.lane,
    side: note.side,
    holdMs: note.holdMs ?? 0,
    kind: note.kind ?? 'normal',
  };
}
