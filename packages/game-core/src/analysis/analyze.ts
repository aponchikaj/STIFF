import { detectOnsets, spectralFlux, type OnsetOptions } from './onsets';
import { frameToMs, spectrogram } from './spectral';
import type { AnalysisResult, Onset, Section } from './types';

/**
 * Stage A, start to finish: samples in, `AnalysisResult` out.
 *
 * Deterministic. The same audio gives the same answer on every machine, which
 * is what lets a chart be regenerated later and compared against the one that
 * shipped.
 */

export const MIN_BPM = 70;
export const MAX_BPM = 200;

export interface AnalyzeOptions extends OnsetOptions {
  /** Overrides detection when a human has already corrected the tempo. */
  bpmOverride?: number;
  targetSectionCount?: number;
}

export function analyze(
  samples: Float32Array,
  sampleRate: number,
  options: AnalyzeOptions = {},
): AnalysisResult {
  const spec = spectrogram(samples, sampleRate);
  const durationMs = Math.round((samples.length / sampleRate) * 1000);
  const onsets = detectOnsets(spec, options);

  const tempo = options.bpmOverride
    ? { bpm: options.bpmOverride, confidence: 1 }
    : refineTempo(
        estimateTempo(spectralFlux(spec), spec.hopSize, sampleRate),
        onsets,
      );

  const beatMs = 60_000 / tempo.bpm;
  const firstBeatMs = onsets[0]?.ms ?? 0;

  const beatGrid: number[] = [];
  for (let t = firstBeatMs; t < durationMs; t += beatMs) {
    beatGrid.push(Math.round(t));
  }

  for (const onset of onsets) {
    onset.beat = Number(((onset.ms - firstBeatMs) / beatMs).toFixed(3));
  }

  return {
    bpm: Number(tempo.bpm.toFixed(2)),
    bpmConfidence: Number(tempo.confidence.toFixed(3)),
    durationMs,
    sampleRate,
    beatGrid,
    sections: buildSections(spec, onsets, durationMs, options.targetSectionCount),
    onsets,
  };
}

/**
 * Tempo from the autocorrelation of the onset envelope.
 *
 * The envelope repeats at the beat period, so the lag with the strongest
 * self-similarity is the beat. Searched over 70–200 BPM: below that a "beat"
 * is more likely half-time detected wrong, and above it double-time.
 *
 * Confidence is how far the winning peak stands above the mean correlation.
 * A track with no steady pulse still returns a number, and this is what says
 * not to trust it.
 */
export function estimateTempo(
  envelope: Float64Array,
  hopSize: number,
  sampleRate: number,
): { bpm: number; confidence: number } {
  const framesPerSecond = sampleRate / hopSize;
  // Rounded *inward*, not outward. Rounding out lets a lag just past the edge
  // win — which is how a 140 BPM track was being reported as 69.8, exactly
  // half, from a lag one frame beyond the 70 BPM floor.
  const minLag = Math.ceil((60 / MAX_BPM) * framesPerSecond);
  const maxLag = Math.floor((60 / MIN_BPM) * framesPerSecond);

  if (envelope.length < maxLag * 2) {
    return { bpm: 120, confidence: 0 };
  }

  let envelopeMean = 0;
  for (const value of envelope) envelopeMean += value;
  envelopeMean /= envelope.length;

  const centred = Float64Array.from(envelope, (value) => value - envelopeMean);

  const scores: number[] = [];
  let bestLag = minLag;
  let bestScore = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < centred.length; i++) {
      sum += centred[i]! * centred[i + lag]!;
    }
    const score = sum / (centred.length - lag);
    scores.push(score);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  /*
   * Parabolic interpolation around the winning lag.
   *
   * Autocorrelation only samples integer lags, and at these hop sizes one lag
   * is worth two to three BPM — enough that a 120 BPM track reads as 117.5 and
   * its beat grid drifts a full second across a minute, which is unusable for
   * charting. Fitting a parabola through the peak and its two neighbours
   * recovers the sub-lag maximum and brings the error under half a percent.
   */
  const index = bestLag - minLag;
  const before = scores[index - 1];
  const after = scores[index + 1];
  let refinedLag = bestLag;
  if (before !== undefined && after !== undefined) {
    const denominator = before - 2 * bestScore + after;
    if (denominator !== 0) {
      const shift = (0.5 * (before - after)) / denominator;
      // A shift beyond half a bin means the peak is not where it was found,
      // which is a sign of a noisy curve rather than a precise answer.
      if (Math.abs(shift) <= 0.5) refinedLag = bestLag + shift;
    }
  }

  const bpm = (60 * framesPerSecond) / refinedLag;

  /*
   * Confidence is how far the winner stands out from the field, in standard
   * deviations, squashed into 0..1.
   *
   * The previous formula compared the peak to the *mean* and got this exactly
   * backwards: uncorrelated noise has a mean near zero, so any positive peak
   * looked infinitely confident, and pure noise scored higher than a click
   * track. What separates a real pulse from noise is not the height of the
   * best lag but whether the other lags are much lower than it.
   */
  const scoreMean = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  const variance =
    scores.reduce((sum, value) => sum + (value - scoreMean) ** 2, 0) /
    (scores.length || 1);
  const stdDev = Math.sqrt(variance);
  const z = stdDev > 0 ? (bestScore - scoreMean) / stdDev : 0;
  // A click track lands around z = 4-6; noise sits near 2.
  const confidence = Math.max(0, Math.min(1, (z - 2) / 4));

  return { bpm, confidence };
}

/**
 * Section boundaries from where loudness changes.
 *
 * A proper self-similarity matrix would find musical structure better, and it
 * is O(frames squared) — on a three-minute track that is 60 million cells per
 * song. This looks for the largest jumps in a smoothed RMS curve, which finds
 * the drop and the breakdown, and those are what the section plan actually
 * turns on.
 */
function buildSections(
  spec: { rms: Float64Array; hopSize: number; frameSize: number; sampleRate: number },
  onsets: Onset[],
  durationMs: number,
  target = 8,
): Section[] {
  const smoothed = smooth(spec.rms, 24);
  if (smoothed.length === 0) {
    return [{ index: 0, startMs: 0, endMs: durationMs, rms: 0, onsetCount: onsets.length }];
  }

  // Candidate boundaries: the biggest absolute changes in smoothed loudness,
  // kept apart so two frames of one transition are not two sections.
  const minGapFrames = Math.floor(
    (8 * spec.sampleRate) / spec.hopSize / 1, // ~8 seconds
  );
  const changes: { frame: number; delta: number }[] = [];
  for (let f = 1; f < smoothed.length; f++) {
    changes.push({ frame: f, delta: Math.abs(smoothed[f]! - smoothed[f - 1]!) });
  }
  changes.sort((a, b) => b.delta - a.delta);

  const boundaries: number[] = [0];
  for (const change of changes) {
    if (boundaries.length >= target) break;
    if (boundaries.every((b) => Math.abs(b - change.frame) >= minGapFrames)) {
      boundaries.push(change.frame);
    }
  }
  boundaries.sort((a, b) => a - b);

  const sections: Section[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const startFrame = boundaries[i]!;
    const endFrame = boundaries[i + 1] ?? smoothed.length;

    // The first frame's centre is half a window in, but the first section
    // starts at the start of the song — anything else leaves the opening
    // moments in no section at all.
    const startMs =
      i === 0
        ? 0
        : Math.round(
            frameToMs(startFrame, spec.hopSize, spec.frameSize, spec.sampleRate),
          );
    const endMs =
      i + 1 < boundaries.length
        ? Math.round(
            frameToMs(endFrame, spec.hopSize, spec.frameSize, spec.sampleRate),
          )
        : durationMs;

    let sum = 0;
    for (let f = startFrame; f < endFrame; f++) sum += spec.rms[f] ?? 0;
    const frames = Math.max(1, endFrame - startFrame);

    sections.push({
      index: i,
      startMs,
      endMs,
      rms: Number((sum / frames).toFixed(4)),
      onsetCount: onsets.filter((o) => o.ms >= startMs && o.ms < endMs).length,
    });
  }

  return sections;
}

function smooth(values: Float64Array, radius: number): Float64Array {
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const from = Math.max(0, i - radius);
    const to = Math.min(values.length, i + radius + 1);
    let sum = 0;
    for (let j = from; j < to; j++) sum += values[j]!;
    out[i] = sum / (to - from);
  }
  return out;
}

/**
 * Sharpens a coarse tempo against the onset times.
 *
 * Autocorrelation of the flux envelope is quantised to the hop — about 2.5 BPM
 * at these settings — and even with parabolic interpolation the peak is broad
 * enough to leave a percent or two of error. Over three minutes that is a beat
 * grid drifting by seconds.
 *
 * The onsets themselves are far more precise, so this treats them as an
 * impulse train and finds the period whose fundamental they line up on best.
 * Summing `strength * exp(2πi·t/P)` and taking the magnitude scores a
 * candidate period independently of phase, which means there is no need to
 * guess where beat one is in order to measure how long a beat is.
 *
 * Searched only within a few percent of the coarse estimate: this refines an
 * answer, it does not look for a different one, and letting it roam would just
 * reintroduce the octave errors autocorrelation already ruled out.
 */
export function refineTempo(
  coarse: { bpm: number; confidence: number },
  onsets: Onset[],
): { bpm: number; confidence: number } {
  if (onsets.length < 8) return coarse;

  const coarsePeriod = 60_000 / coarse.bpm;
  const span = coarsePeriod * 0.06;
  const step = coarsePeriod / 4000;

  let bestPeriod = coarsePeriod;
  let bestMagnitude = -Infinity;

  for (let period = coarsePeriod - span; period <= coarsePeriod + span; period += step) {
    let re = 0;
    let im = 0;
    for (const onset of onsets) {
      const angle = (2 * Math.PI * onset.ms) / period;
      re += onset.strength * Math.cos(angle);
      im += onset.strength * Math.sin(angle);
    }
    const magnitude = Math.hypot(re, im);
    if (magnitude > bestMagnitude) {
      bestMagnitude = magnitude;
      bestPeriod = period;
    }
  }

  // How much of the total onset energy lines up on this period: 1 means every
  // onset sits exactly on a beat, 0 means they are scattered.
  const totalStrength = onsets.reduce((sum, o) => sum + o.strength, 0);
  const alignment = totalStrength > 0 ? bestMagnitude / totalStrength : 0;

  return {
    bpm: 60_000 / bestPeriod,
    // Keep the weaker of the two signals: a sharp period fitted to onsets that
    // had no pulse behind them is precision without accuracy.
    confidence: Math.min(coarse.confidence, alignment),
  };
}
