/**
 * The signal-processing floor: an FFT and a spectrogram.
 *
 * Written out rather than pulled from a library on purpose. The brief proposed
 * `essentia.js`, which is a several-megabyte WASM bundle carrying a hundred
 * algorithms to get the two used here — and it would have to load in a worker,
 * in CI, and in every test. Spectral flux over a Hann-windowed STFT is about a
 * hundred lines, is deterministic, and can be tested against a signal whose
 * answer is known by construction.
 *
 * If onset accuracy turns out to be insufficient on real music, the brief's
 * fallback stands: a Python sidecar with `madmom`. That decision needs real
 * songs to make, and there are none yet.
 */

/**
 * In-place iterative radix-2 Cooley-Tukey.
 *
 * `re` and `im` must be the same power-of-two length. Operating in place and
 * reusing the caller's arrays is what keeps a full spectrogram from allocating
 * a fresh pair per frame.
 */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1) return;
  if ((n & (n - 1)) !== 0) {
    throw new Error(`fft: length ${n} is not a power of two`);
  }

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k]!;
        const aIm = im[i + k]!;
        const bRe = re[i + k + len / 2]!;
        const bIm = im[i + k + len / 2]!;

        const tRe = bRe * curRe - bIm * curIm;
        const tIm = bRe * curIm + bIm * curRe;

        re[i + k] = aRe + tRe;
        im[i + k] = aIm + tIm;
        re[i + k + len / 2] = aRe - tRe;
        im[i + k + len / 2] = aIm - tIm;

        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

export interface Spectrogram {
  /** One magnitude spectrum per frame; each is `frameSize / 2` bins. */
  frames: Float64Array[];
  /** Root-mean-square amplitude per frame, for section loudness. */
  rms: Float64Array;
  hopSize: number;
  frameSize: number;
  sampleRate: number;
}

export const DEFAULT_FRAME = 1024;
export const DEFAULT_HOP = 512;

/**
 * Short-time Fourier transform with a Hann window.
 *
 * Hann rather than rectangular because a rectangular window smears a pure tone
 * across every bin, and spectral flux would then read that smearing as an
 * onset on every frame.
 */
export function spectrogram(
  samples: Float32Array,
  sampleRate: number,
  frameSize = DEFAULT_FRAME,
  hopSize = DEFAULT_HOP,
): Spectrogram {
  const window = hannWindow(frameSize);
  const bins = frameSize / 2;
  const frameCount = Math.max(
    0,
    Math.floor((samples.length - frameSize) / hopSize) + 1,
  );

  const frames: Float64Array[] = [];
  const rms = new Float64Array(frameCount);

  const re = new Float64Array(frameSize);
  const im = new Float64Array(frameSize);

  for (let f = 0; f < frameCount; f++) {
    const offset = f * hopSize;
    let energy = 0;

    for (let i = 0; i < frameSize; i++) {
      const sample = samples[offset + i] ?? 0;
      energy += sample * sample;
      re[i] = sample * window[i]!;
      im[i] = 0;
    }
    rms[f] = Math.sqrt(energy / frameSize);

    fft(re, im);

    const magnitude = new Float64Array(bins);
    for (let b = 0; b < bins; b++) {
      magnitude[b] = Math.hypot(re[b]!, im[b]!);
    }
    frames.push(magnitude);
  }

  return { frames, rms, hopSize, frameSize, sampleRate };
}

export function hannWindow(size: number): Float64Array {
  const window = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

/** Frame index to milliseconds, at the centre of the frame. */
export function frameToMs(
  frame: number,
  hopSize: number,
  frameSize: number,
  sampleRate: number,
): number {
  return ((frame * hopSize + frameSize / 2) / sampleRate) * 1000;
}
