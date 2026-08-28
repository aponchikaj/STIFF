/**
 * Turning a handful of taps into one offset.
 *
 * Lives here rather than in the game client because it is pure arithmetic with
 * no browser in it, and because a number that decides how the whole game feels
 * deserves tests. The parts that genuinely need an `AudioContext` — scheduling
 * the metronome click — stay in the client.
 */

/** How many taps the audio test collects before it will report a result. */
export const REQUIRED_TAPS = 16;

/** Interval between metronome clicks. Slow enough to tap accurately to. */
export const METRONOME_INTERVAL_MS = 600;

/**
 * The median of the taps, with outliers thrown away first.
 *
 * Median rather than mean because a calibration run reliably contains a few
 * taps that are not measurements: the first one before the player has found
 * the rhythm, one where they were distracted, one where the browser stalled. A
 * mean lets any of those drag the result several milliseconds, and several
 * milliseconds is a third of the Sick window.
 */
export function medianOffsetMs(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  const kept = rejectOutliers(samples);
  // Falling back to the raw samples matters: if a player taps so erratically
  // that almost everything is an outlier, reporting a median of the two
  // survivors would be worse than reporting the median of the mess.
  const usable = kept.length >= 3 ? kept : [...samples];
  return Math.round(median(usable));
}

/**
 * Modified z-score filter, using median absolute deviation.
 *
 * MAD rather than standard deviation for the same reason the centre is a
 * median: the statistic used to *detect* outliers must not itself be dragged
 * around by them. One tap 400ms late inflates a standard deviation enough to
 * keep itself inside the threshold.
 */
export function rejectOutliers(samples: readonly number[]): number[] {
  if (samples.length < 4) return [...samples];

  const centre = median(samples);
  const mad = median(samples.map((s) => Math.abs(s - centre)));

  // A perfectly consistent tapper has a MAD of zero. Keeping everything is
  // then correct, and dividing by it would not be.
  if (mad === 0) return [...samples];

  // 3.5 is the conventional threshold; 0.6745 converts MAD into a
  // standard-deviation equivalent for a normal distribution.
  return samples.filter((s) => (0.6745 * Math.abs(s - centre)) / mad < 3.5);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Spread of the kept samples, shown so a player can see they tapped steadily. */
export function spreadMs(samples: readonly number[]): number {
  const kept = rejectOutliers(samples);
  if (kept.length < 2) return 0;
  const centre = median(kept);
  return Math.round(median(kept.map((s) => Math.abs(s - centre))));
}

/**
 * Distance from a tap to the click it was aimed at.
 *
 * Wraps at half the interval, so a tap landing slightly *before* a click reads
 * as a small negative rather than as being enormously late for the previous
 * one. Without the wrap, a player who anticipates the beat — which is most of
 * them — calibrates to roughly one whole beat of error.
 */
export function offsetToNearestBeat(
  tapMs: number,
  intervalMs: number = METRONOME_INTERVAL_MS,
): number {
  const phase = ((tapMs % intervalMs) + intervalMs) % intervalMs;
  return phase > intervalMs / 2 ? phase - intervalMs : phase;
}
