import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';

/**
 * Audio in, raw samples out.
 *
 * ffmpeg does the decoding because it decodes everything, and shelling out to
 * it is preferable to carrying a decoder per format in-process. The output is
 * mono 32-bit float at 22.05kHz — analysis only needs the spectrum up to about
 * 10kHz, and a quarter of the samples is a quarter of the FFT work.
 *
 * This is the only place in the game that touches the filesystem or a
 * subprocess, which is why it is a service rather than a helper: it is the
 * thing that will one day move to a worker.
 */

export const ANALYSIS_SAMPLE_RATE = 22_050;

/** A cap, because a decode is unbounded work driven by an uploaded file. */
export const MAX_DURATION_SECONDS = 15 * 60;

@Injectable()
export class AudioDecodeService {
  private readonly logger = new Logger(AudioDecodeService.name);

  /**
   * Decodes to mono float samples.
   *
   * Reads from stdin rather than a temporary file so an upload never has to be
   * written to disk to be analysed.
   */
  async decode(input: Buffer): Promise<{
    samples: Float32Array;
    sampleRate: number;
    durationMs: number;
  }> {
    const chunks: Buffer[] = [];
    const errors: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        'pipe:0',
        '-ac',
        '1',
        '-ar',
        String(ANALYSIS_SAMPLE_RATE),
        '-t',
        String(MAX_DURATION_SECONDS),
        '-f',
        'f32le',
        'pipe:1',
      ]);

      ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      ffmpeg.stderr.on('data', (chunk: Buffer) =>
        errors.push(chunk.toString()),
      );

      ffmpeg.on('error', (error) => {
        reject(
          new Error(
            `ffmpeg could not be started (${error.message}). Install it with \`brew install ffmpeg\`.`,
          ),
        );
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(`ffmpeg exited ${code}: ${errors.join('').trim()}`));
      });

      ffmpeg.stdin.on('error', () => {
        // ffmpeg rejecting the input closes stdin early; the real error comes
        // from stderr and the close handler, so this must not be fatal here.
      });
      ffmpeg.stdin.end(input);
    });

    const buffer = Buffer.concat(chunks);
    // The bytes are already little-endian float32; reading them through a
    // Float32Array view avoids copying the whole track a second time.
    const samples = new Float32Array(
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength - (buffer.byteLength % 4),
      ),
    );

    this.logger.log(
      `decoded ${(samples.length / ANALYSIS_SAMPLE_RATE).toFixed(1)}s of audio`,
    );

    return {
      samples,
      sampleRate: ANALYSIS_SAMPLE_RATE,
      durationMs: Math.round((samples.length / ANALYSIS_SAMPLE_RATE) * 1000),
    };
  }

  /** Whether ffmpeg is present, so the panel can say so before an upload. */
  async available(): Promise<boolean> {
    return new Promise((resolve) => {
      const probe = spawn('ffmpeg', ['-version']);
      probe.on('error', () => resolve(false));
      probe.on('close', (code) => resolve(code === 0));
    });
  }
}
