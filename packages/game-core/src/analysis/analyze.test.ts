import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { analyze, estimateTempo, refineTempo } from './analyze';
import { detectOnsets, medianOf, spectralFlux } from './onsets';
import { fft, spectrogram } from './spectral';

/**
 * Tested against signals whose answer is known by construction rather than
 * against a recording, because "did it find the beat" is only checkable when
 * you put the beat there yourself.
 */

const SR = 22_050;

/** A click track: short decaying tones at an exact tempo. */
function clickTrack(
  bpm: number,
  seconds: number,
  frequency = 1000,
  sampleRate = SR,
): Float32Array {
  const samples = new Float32Array(Math.floor(seconds * sampleRate));
  const beatSamples = Math.round((60 / bpm) * sampleRate);
  const clickLength = Math.round(0.03 * sampleRate);

  for (let start = 0; start + clickLength < samples.length; start += beatSamples) {
    for (let i = 0; i < clickLength; i++) {
      const decay = Math.exp(-8 * (i / clickLength));
      samples[start + i] =
        0.8 * decay * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    }
  }
  return samples;
}

describe('fft', () => {
  test('recovers a pure tone in the right bin', () => {
    const n = 1024;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    // Exactly 64 cycles across the window, so the energy lands in bin 64 with
    // no leakage to argue about.
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 64 * i) / n);

    fft(re, im);

    let peakBin = 0;
    let peak = 0;
    for (let b = 1; b < n / 2; b++) {
      const magnitude = Math.hypot(re[b]!, im[b]!);
      if (magnitude > peak) {
        peak = magnitude;
        peakBin = b;
      }
    }
    assert.equal(peakBin, 64);
  });

  test('refuses a non-power-of-two length', () => {
    assert.throws(() => fft(new Float64Array(100), new Float64Array(100)));
  });

  test('a silent signal has no energy', () => {
    const re = new Float64Array(256);
    const im = new Float64Array(256);
    fft(re, im);
    assert.ok(re.every((v) => v === 0));
  });
});

describe('spectrogram', () => {
  test('frames a signal at the expected rate', () => {
    const spec = spectrogram(clickTrack(120, 2), SR);
    // (samples - frame) / hop + 1, with the defaults.
    const expected = Math.floor((2 * SR - 1024) / 512) + 1;
    assert.equal(spec.frames.length, expected);
    assert.equal(spec.frames[0]?.length, 512);
  });

  test('rms tracks loudness', () => {
    const loud = spectrogram(clickTrack(120, 2), SR);
    const quiet = spectrogram(
      Float32Array.from(clickTrack(120, 2), (v) => v * 0.1),
      SR,
    );
    const mean = (a: Float64Array) => a.reduce((x, y) => x + y, 0) / a.length;
    assert.ok(mean(loud.rms) > mean(quiet.rms) * 5);
  });
});

describe('onset detection', () => {
  test('finds one onset per click', () => {
    const seconds = 8;
    const bpm = 120;
    const spec = spectrogram(clickTrack(bpm, seconds), SR);
    const onsets = detectOnsets(spec);

    const expected = Math.floor((seconds * bpm) / 60);
    // Edge frames make the first and last click ambiguous; anything closer
    // than one either way is the detector working.
    assert.ok(
      Math.abs(onsets.length - expected) <= 1,
      `found ${onsets.length}, expected about ${expected}`,
    );
  });

  test('onsets land on the clicks, not between them', () => {
    const bpm = 120;
    const beatMs = 60_000 / bpm;
    const spec = spectrogram(clickTrack(bpm, 8), SR);
    const onsets = detectOnsets(spec);

    for (const onset of onsets) {
      const offBy = Math.abs(onset.ms - Math.round(onset.ms / beatMs) * beatMs);
      // One hop is ~23ms at this rate, so half a hop of error is the floor.
      assert.ok(offBy < 40, `onset at ${onset.ms}ms is ${offBy}ms off the grid`);
    }
  });

  test('silence produces no onsets', () => {
    const spec = spectrogram(new Float32Array(SR * 2), SR);
    assert.deepEqual(detectOnsets(spec), []);
  });

  test('strength is normalised to the loudest onset', () => {
    const spec = spectrogram(clickTrack(120, 8), SR);
    const onsets = detectOnsets(spec);
    assert.ok(onsets.length > 0);
    assert.ok(Math.max(...onsets.map((o) => o.strength)) === 1);
    assert.ok(onsets.every((o) => o.strength > 0 && o.strength <= 1));
  });

  test('a low tone and a high tone land in different bands', () => {
    const low = detectOnsets(spectrogram(clickTrack(120, 6, 80), SR));
    const high = detectOnsets(spectrogram(clickTrack(120, 6, 6000), SR));
    assert.equal(low[1]?.band, 'low');
    assert.equal(high[1]?.band, 'high');
  });

  test('respects the minimum gap', () => {
    const spec = spectrogram(clickTrack(180, 8), SR);
    const onsets = detectOnsets(spec, { minGapMs: 200 });
    for (let i = 1; i < onsets.length; i++) {
      assert.ok(onsets[i]!.ms - onsets[i - 1]!.ms >= 200);
    }
  });
});

describe('tempo estimation', () => {
  for (const bpm of [90, 120, 140, 174]) {
    test(`recovers ${bpm} BPM from a click track`, () => {
      const spec = spectrogram(clickTrack(bpm, 20), SR);
      const { bpm: found } = estimateTempo(
        spectralFlux(spec),
        spec.hopSize,
        SR,
      );
      // The coarse stage only has to land in the right octave — it is
      // quantised to the hop, so a couple of percent is the floor here. The
      // precision comes from `refineTempo`, tested below.
      const error = Math.abs(found - bpm) / bpm;
      assert.ok(error < 0.04, `found ${found.toFixed(2)} for ${bpm}`);
    });
  }

  for (const bpm of [90, 120, 140, 174, 200]) {
    test(`refines ${bpm} BPM to better than a tenth of a percent`, () => {
      // This is the number that matters: the coarse peak is worth ~2.5 BPM,
      // which drifts a beat grid by seconds over a three-minute song. Fitting
      // the period to the onset times instead brings it to 0.01%.
      const found = analyze(clickTrack(bpm, 20), SR).bpm;
      const error = Math.abs(found - bpm) / bpm;
      assert.ok(error < 0.001, `analyze found ${found.toFixed(2)} for ${bpm}`);
    });
  }

  test('refinement declines to guess from too few onsets', () => {
    const coarse = { bpm: 128, confidence: 0.5 };
    assert.deepEqual(refineTempo(coarse, []), coarse);
  });

  test('refinement stays near the coarse answer', () => {
    // It sharpens an answer rather than looking for a different one; letting
    // it roam would reintroduce the octave errors autocorrelation ruled out.
    const onsets = Array.from({ length: 40 }, (_, i) => ({
      ms: i * 500,
      beat: i,
      strength: 1,
      band: 'low' as const,
    }));
    const refined = refineTempo({ bpm: 118, confidence: 0.5 }, onsets);
    assert.ok(Math.abs(refined.bpm - 118) / 118 <= 0.06);
  });

  test('reports low confidence on noise', () => {
    // Deterministic pseudo-noise: no pulse to find, so the answer should say
    // so rather than inventing a tempo with authority.
    const samples = new Float32Array(SR * 10);
    let seed = 12345;
    for (let i = 0; i < samples.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      samples[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    const spec = spectrogram(samples, SR);
    const { confidence } = estimateTempo(spectralFlux(spec), spec.hopSize, SR);
    const clicky = spectrogram(clickTrack(120, 10), SR);
    const clean = estimateTempo(spectralFlux(clicky), clicky.hopSize, SR);
    assert.ok(
      confidence < clean.confidence,
      `noise ${confidence} should be less certain than a click track ${clean.confidence}`,
    );
  });
});

describe('analyze', () => {
  test('produces a complete result for a click track', () => {
    const result = analyze(clickTrack(120, 20), SR);

    assert.ok(Math.abs(result.bpm - 120) / 120 < 0.005);
    assert.equal(result.sampleRate, SR);
    assert.ok(Math.abs(result.durationMs - 20_000) < 100);
    assert.ok(result.onsets.length > 30);
    assert.ok(result.beatGrid.length > 30);
    assert.ok(result.sections.length >= 1);
  });

  test('is deterministic', () => {
    const samples = clickTrack(140, 12);
    assert.deepEqual(analyze(samples, SR), analyze(samples, SR));
  });

  test('a manual tempo override wins over detection', () => {
    // A human correcting the BPM must not be silently re-derived away.
    const result = analyze(clickTrack(120, 12), SR, { bpmOverride: 174 });
    assert.equal(result.bpm, 174);
    assert.equal(result.bpmConfidence, 1);
  });

  test('onset beats are relative to the first onset', () => {
    const result = analyze(clickTrack(120, 12), SR);
    assert.equal(result.onsets[0]?.beat, 0);
    // Consecutive clicks are one beat apart.
    const second = result.onsets[1]?.beat ?? 0;
    assert.ok(Math.abs(second - 1) < 0.2, `second onset at beat ${second}`);
  });

  test('sections cover the song without gaps', () => {
    const result = analyze(clickTrack(120, 30), SR);
    for (let i = 1; i < result.sections.length; i++) {
      assert.equal(result.sections[i]!.startMs, result.sections[i - 1]!.endMs);
    }
    assert.equal(result.sections[0]?.startMs, 0);
    assert.equal(
      result.sections[result.sections.length - 1]?.endMs,
      result.durationMs,
    );
  });
});

describe('medianOf', () => {
  test('odd and even lengths', () => {
    assert.equal(medianOf([3, 1, 2]), 2);
    assert.equal(medianOf([4, 1, 3, 2]), 2.5);
    assert.equal(medianOf([]), 0);
  });
});
