import type { Band, Onset } from './types';
import { frameToMs, type Spectrogram } from './spectral';

/**
 * Finding the moments a chart could put a note on.
 *
 * Spectral flux: how much the magnitude spectrum *grew* between consecutive
 * frames. Only growth counts — a note ending is not a note starting, and
 * summing absolute change would put an onset at both ends of every sound.
 */

export interface OnsetOptions {
  /** Frames either side used for the adaptive threshold. */
  medianWindow?: number;
  /** How far above the local median a peak must sit. */
  thresholdDelta?: number;
  /** Minimum gap between onsets, in milliseconds. */
  minGapMs?: number;
}

/** Per-frame spectral flux, normalised to 0..1. */
export function spectralFlux(spec: Spectrogram): Float64Array {
  const flux = new Float64Array(spec.frames.length);

  for (let f = 1; f < spec.frames.length; f++) {
    const current = spec.frames[f]!;
    const previous = spec.frames[f - 1]!;
    let sum = 0;
    for (let b = 0; b < current.length; b++) {
      // Half-wave rectified: growth only.
      const diff = current[b]! - previous[b]!;
      if (diff > 0) sum += diff;
    }
    flux[f] = sum;
  }

  let peak = 0;
  for (const value of flux) if (value > peak) peak = value;
  if (peak > 0) for (let i = 0; i < flux.length; i++) flux[i]! /= peak;

  return flux;
}

/**
 * Peak-picking with an adaptive threshold.
 *
 * A fixed threshold either misses everything in a quiet passage or fires on
 * every frame in a loud one. Comparing each frame to the median of its
 * neighbourhood makes the detector care about *local* prominence, which is
 * what a listener hears.
 */
export function detectOnsets(
  spec: Spectrogram,
  options: OnsetOptions = {},
): Onset[] {
  const medianWindow = options.medianWindow ?? 12;
  const delta = options.thresholdDelta ?? 0.035;
  const minGapMs = options.minGapMs ?? 45;

  const flux = spectralFlux(spec);
  const onsets: Onset[] = [];
  let lastMs = -Infinity;

  for (let f = 1; f < flux.length - 1; f++) {
    const value = flux[f]!;
    if (value <= 0) continue;

    // Must be a local maximum, or a sustained loud passage becomes one long
    // onset rather than the notes inside it.
    if (value < flux[f - 1]! || value < flux[f + 1]!) continue;

    const from = Math.max(0, f - medianWindow);
    const to = Math.min(flux.length, f + medianWindow + 1);
    const local = medianOf(flux.subarray(from, to));
    if (value < local + delta) continue;

    const ms = frameToMs(f, spec.hopSize, spec.frameSize, spec.sampleRate);
    if (ms - lastMs < minGapMs) continue;
    lastMs = ms;

    onsets.push({
      ms: Math.round(ms),
      // Filled in once tempo is known; the grid is not available yet here.
      beat: 0,
      strength: value,
      band: bandOf(spec.frames[f]!, spec.sampleRate, spec.frameSize),
    });
  }

  // Re-normalise strength against the strongest onset actually kept, so the
  // charter's thresholds mean the same thing on a quiet track and a loud one.
  let strongest = 0;
  for (const onset of onsets) {
    if (onset.strength > strongest) strongest = onset.strength;
  }
  if (strongest > 0) {
    for (const onset of onsets) {
      onset.strength = Number((onset.strength / strongest).toFixed(4));
    }
  }

  return onsets;
}

/**
 * Which lane group an onset belongs to, from where its energy sits.
 *
 * Crossovers at 250Hz and 2kHz: kick and bass below, most of the melody in the
 * middle, hats and snare transients above. Crude next to a real timbre
 * classifier, and enough to stop a chart putting every kick and every hat in
 * the same lane.
 */
export function bandOf(
  magnitude: Float64Array,
  sampleRate: number,
  frameSize: number,
): Band {
  const hzPerBin = sampleRate / frameSize;
  let low = 0;
  let mid = 0;
  let high = 0;

  for (let b = 0; b < magnitude.length; b++) {
    const hz = b * hzPerBin;
    const value = magnitude[b]!;
    if (hz < 250) low += value;
    else if (hz < 2000) mid += value;
    else high += value;
  }

  if (low >= mid && low >= high) return 'low';
  if (high >= mid) return 'high';
  return 'mid';
}

export function medianOf(values: ArrayLike<number>): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : ((sorted[mid - 1]! + sorted[mid]!) / 2);
}
