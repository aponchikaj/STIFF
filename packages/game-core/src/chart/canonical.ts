import { resolveNote, type Chart, type Note, type ResolvedNote } from './types';

/**
 * Sort order for notes: time, then lane, then side.
 *
 * Two notes may legitimately share a timestamp — a jump is two lanes at once,
 * and player and opponent frequently hit together — so the comparator has to
 * be total, or the canonical form is not stable and neither is the hash.
 */
export function compareNotes(a: Note, b: Note): number {
  if (a.t !== b.t) return a.t - b.t;
  if (a.lane !== b.lane) return a.lane - b.lane;
  if (a.side === b.side) return 0;
  return a.side === 'opponent' ? -1 : 1;
}

export function sortNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort(compareNotes);
}

/**
 * The canonical string form of a chart, and the exact input to `hashChart`.
 *
 * What goes in is *only what the scorer reads*, and the omissions are the
 * interesting part:
 *
 * - `events` (camera focus, zoom, stage triggers) are presentation. Including
 *   them would mean a designer nudging a camera cue invalidates every run ever
 *   submitted against the chart, wiping its leaderboard for no gameplay reason.
 * - `scrollSpeed` is a default the player is allowed to override from
 *   accessibility settings, so it cannot be part of the chart's identity.
 * - `bpmChanges` drive the beat grid for visuals and the editor. Notes carry
 *   absolute milliseconds, so tempo never reaches the judgement math.
 * - `meta` is provenance.
 *
 * The rule to hold onto: if changing a field can change the score a given
 * input log produces, it belongs in the hash. If it cannot, it must not — or
 * the hash stops meaning "the player and the server judged the same chart"
 * and starts meaning "nobody has touched this row", which is a different and
 * far less useful guarantee.
 */
export function canonicalizeChart(chart: Chart): string {
  const header = ['v' + String(chart.version), chart.songId, chart.difficulty].join('|');
  const notes = sortNotes(chart.notes).map(canonicalizeNote);
  return [header, ...notes].join('\n');
}

function canonicalizeNote(note: Note): string {
  const r: ResolvedNote = resolveNote(note);
  // Fixed field order and resolved defaults: `{t, lane}` and
  // `{lane, t, kind: 'normal'}` describe the same note and must hash alike.
  return [r.t, r.lane, r.side, r.holdMs, r.kind].join('|');
}
