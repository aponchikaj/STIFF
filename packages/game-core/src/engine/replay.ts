import type { Chart } from '../chart/types';
import { rankOf, accuracyPercent } from '../scoring/score-state';
import type { Judgement, Rank } from '../scoring/judgement';
import { ChartRuntime, type RuntimeOptions } from './chart-runtime';
import { validateInputLog, type InputEvent } from './input';

/**
 * Score an input log against a chart, with no clock involved.
 *
 * This is what the server runs on every submission, and it is deliberately not
 * a reimplementation of scoring — it drives the same `ChartRuntime` the client
 * drives live. If the two ever disagreed it would mean the runtime reads
 * something outside its arguments, which is the one thing it is written not to
 * do.
 *
 * The stepping is the subtle part. A live client calls `update()` every frame;
 * a replay has no frames, so it advances the clock to each input event, and
 * then in fixed steps between events. Fixed steps matter because holds pay out
 * on a `HOLD_TICK_MS` grid and misses fire when a window closes — advancing
 * straight from one input to the next would still produce the right answer
 * (both are computed from absolute times, not from elapsed deltas), but the
 * intermediate stepping makes that property *testable* rather than assumed.
 */

export interface ReplayResult {
  score: number;
  accuracy: number;
  maxCombo: number;
  rank: Rank;
  counts: Record<Judgement, number>;
  holdTicks: number;
  failed: boolean;
  /**
   * Signed timing errors, in order. The anti-cheat heuristics read this — a
   * human's errors are roughly Gaussian with a non-zero mean, a bot's are
   * near-zero or quantised to a frame boundary.
   */
  deltas: number[];
}

export class ReplayError extends Error {}

export function replay(
  chart: Chart,
  inputs: readonly InputEvent[],
  options: RuntimeOptions & { songDurationMs?: number } = {},
): ReplayResult {
  const problem = validateInputLog(inputs);
  if (problem) throw new ReplayError(problem);

  const runtime = new ChartRuntime(chart, options);

  // Run past the last note by the full miss window, so notes nobody pressed
  // are judged as misses rather than left unresolved.
  const lastNote = chart.notes.reduce((max, n) => Math.max(max, n.t + (n.holdMs ?? 0)), 0);
  const endMs = Math.max(options.songDurationMs ?? 0, lastNote + 1000);

  const STEP_MS = 16;
  let cursor = 0;

  for (const event of inputs) {
    while (cursor < event.tMs) {
      cursor = Math.min(cursor + STEP_MS, event.tMs);
      runtime.update(cursor);
    }
    if (event.type === 'press') runtime.press(event.lane, event.tMs);
    else runtime.release(event.lane, event.tMs);
  }

  while (cursor < endMs) {
    cursor = Math.min(cursor + STEP_MS, endMs);
    runtime.update(cursor);
  }

  const deltas: number[] = [];
  for (const note of runtime.notes) {
    if (note.deltaMs !== null) deltas.push(note.deltaMs);
  }

  return {
    score: runtime.state.score,
    accuracy: accuracyPercent(runtime.state),
    maxCombo: runtime.state.maxCombo,
    rank: rankOf(runtime.state),
    counts: { ...runtime.state.counts },
    holdTicks: runtime.state.holdTicks,
    failed: runtime.isFailed,
    deltas,
  };
}
