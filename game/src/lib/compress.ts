"use client";

/**
 * Shrinking a hand-in before it is uploaded.
 *
 * A phone records far more than a watcher needs: a 30-second iPhone clip is
 * 60–200 MB of 4K HEVC, and a photo is a 12-megapixel HEIC. Sent as-is, it
 * fails the 40 MB cap, eats the player's data and their clock, and costs
 * the season to serve. So everything is re-encoded here, in the browser,
 * to the size the backend was designed around (`media-rules.ts`: "720p at
 * ~1.5 Mbps"):
 *
 *   video  → MP4, H.264 (or the first codec the device can encode), short
 *            side 720px, ~1.5 Mbps, ≤30 fps; audio AAC/Opus at 96 kbps.
 *            Roughly 11 MB a minute — a 2-minute clip lands near 22 MB.
 *   photo  → WebP (JPEG where WebP cannot be encoded), long side 2048px.
 *            A 4 MB phone photo comes out around 300–600 KB.
 *
 * Re-encoding also **drops the file's metadata** — and a phone video's
 * metadata carries the GPS position it was shot at. The feed is public;
 * a player's front door should not be in it.
 *
 * Three rules keep this from ever making things worse:
 *   1. A file already small enough is passed through untouched.
 *   2. If the re-encode comes out larger than the original, the original
 *      is used.
 *   3. If the device cannot re-encode at all (no WebCodecs, an unreadable
 *      codec), the original is used — and the size limits decide, exactly
 *      as they did before this existed.
 *
 * The video encoder (`mediabunny`, WebCodecs underneath) is imported only
 * when a clip is picked, so nobody downloads it to look at the feed.
 */

/* Targets. Kept beside the limits they serve. */
const VIDEO_SHORT_SIDE = 720;
const VIDEO_BITRATE = 1_500_000;
const VIDEO_MIN_BITRATE = 500_000;
const VIDEO_MAX_FPS = 30;
const AUDIO_BITRATE = 96_000;
/** A clip at or under this many bits a second, at ≤720p, is left alone. */
const VIDEO_PASS_BITRATE = 2_200_000;

const PHOTO_LONG_SIDE = 2048;
const PHOTO_QUALITY = 0.82;
/** A photo under this size and within the long side is left alone. */
const PHOTO_PASS_BYTES = 900 * 1024;

const PASS_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];
const PASS_PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"];

export interface Prepared {
  file: File;
  width?: number;
  height?: number;
  /** Whole seconds, for a clip. */
  durationSeconds?: number;
  /** What was picked, before any of this. */
  originalBytes: number;
  /** False when the original was passed through. */
  compressed: boolean;
}

export class CompressionCanceled extends Error {
  constructor() {
    super("Compression canceled");
    this.name = "CompressionCanceled";
  }
}

/* ================================================================ photo */

/**
 * Resize and re-encode a still. Orientation is applied on decode
 * (`createImageBitmap` honours EXIF), so the result is upright and carries
 * no EXIF at all — no rotation flag, no location.
 */
export async function preparePhoto(file: File, signal?: AbortSignal): Promise<Prepared> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Undecodable here (HEIC on a browser without HEIC): leave it to the limits.
    return { file, originalBytes: file.size, compressed: false };
  }
  if (signal?.aborted) {
    bitmap.close();
    throw new CompressionCanceled();
  }

  const { width: w, height: h } = bitmap;
  const long = Math.max(w, h);
  if (
    long <= PHOTO_LONG_SIDE &&
    file.size <= PHOTO_PASS_BYTES &&
    PASS_PHOTO_MIME.includes(file.type)
  ) {
    bitmap.close();
    return { file, width: w, height: h, originalBytes: file.size, compressed: false };
  }

  const scale = Math.min(1, PHOTO_LONG_SIDE / long);
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { file, width: w, height: h, originalBytes: file.size, compressed: false };
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // WebP first; a browser that cannot encode it silently hands back PNG,
  // which is the wrong direction — so check, and fall back to JPEG.
  let blob = await toBlob(canvas, "image/webp", PHOTO_QUALITY);
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob(canvas, "image/jpeg", PHOTO_QUALITY);
  }
  canvas.width = canvas.height = 0; // free the backing store on iOS
  if (signal?.aborted) throw new CompressionCanceled();

  if (!blob || (blob.size >= file.size && PASS_PHOTO_MIME.includes(file.type))) {
    return { file, width: w, height: h, originalBytes: file.size, compressed: false };
  }

  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return {
    file: new File([blob], rename(file.name, ext), { type: blob.type }),
    width,
    height,
    originalBytes: file.size,
    compressed: true,
  };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/* ================================================================ video */

export interface VideoProbe {
  width: number;
  height: number;
  durationSeconds: number;
}

/**
 * Re-encode a clip to 720p MP4. `onProgress` gets 0…1. Throws
 * `CompressionCanceled` when `signal` aborts; any other failure resolves to
 * the original file, so a device that cannot encode still hands in.
 *
 * `probe` is called as soon as the clip's length is known — before the slow
 * part — so a clip that is too long can be refused without waiting for an
 * encode whose result would be refused anyway.
 */
export async function prepareVideo(
  file: File,
  {
    onProgress,
    onProbe,
    signal,
  }: {
    onProgress?: (fraction: number) => void;
    /** Return a reason to stop here (too long, too short); null to go on. */
    onProbe?: (probe: VideoProbe) => string | null;
    signal?: AbortSignal;
  } = {},
): Promise<Prepared> {
  const original: Prepared = { file, originalBytes: file.size, compressed: false };

  if (typeof window === "undefined" || !("VideoEncoder" in window)) {
    return original;
  }

  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return original;

    const srcW = track.displayWidth;
    const srcH = track.displayHeight;
    const duration = await input.computeDuration();
    const durationSeconds = Math.round(duration);
    const probe = { width: srcW, height: srcH, durationSeconds };
    original.width = srcW;
    original.height = srcH;
    original.durationSeconds = durationSeconds;

    const refusal = onProbe?.(probe);
    if (refusal) throw new ProbeRefusal(refusal);
    if (signal?.aborted) throw new CompressionCanceled();

    // Already lean: ≤720p and a modest bitrate in a type the server takes.
    const short = Math.min(srcW, srcH);
    const bitsPerSecond = duration > 0 ? (file.size * 8) / duration : Infinity;
    if (
      short <= VIDEO_SHORT_SIDE &&
      bitsPerSecond <= VIDEO_PASS_BITRATE &&
      PASS_VIDEO_MIME.includes(file.type)
    ) {
      return original;
    }

    // Short side to 720, aspect kept, both sides even (encoders insist).
    const scale = Math.min(1, VIDEO_SHORT_SIDE / short);
    const width = even(srcW * scale);
    const height = even(srcH * scale);

    // Fewer pixels than 720p deserve fewer bits.
    const pixelShare = (width * height) / (1280 * 720);
    const bitrate = Math.round(
      Math.max(VIDEO_MIN_BITRATE, Math.min(VIDEO_BITRATE, VIDEO_BITRATE * pixelShare)),
    );

    let frameRate: number | undefined;
    try {
      const stats = await track.computePacketStats(90);
      if (stats.averagePacketRate > VIDEO_MAX_FPS + 1) frameRate = VIDEO_MAX_FPS;
    } catch {
      /* unknown rate: leave it */
    }

    const videoCodec = await mb.getFirstEncodableVideoCodec(["avc", "hevc", "vp9", "av1"], {
      width,
      height,
    });
    if (!videoCodec) return original;
    const audioCodec = await mb.getFirstEncodableAudioCodec(["aac", "opus"]);

    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });

    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: "primary",
      video: {
        width,
        height,
        fit: "fill",
        codec: videoCodec,
        quality: new mb.Quality({ bitrate, bitrateMode: "variable" }),
        ...(frameRate ? { frameRate } : {}),
        keyFrameInterval: 2,
        forceTranscode: true,
      },
      audio: audioCodec
        ? {
            codec: audioCodec,
            quality: new mb.Quality({ bitrate: AUDIO_BITRATE }),
          }
        : { discard: true },
      // No tags carried over: this is where a phone keeps the location.
      tags: () => ({}),
      showWarnings: false,
    });
    if (!conversion.isValid) return original;

    conversion.onProgress = (p) => onProgress?.(Math.min(1, Math.max(0, p)));
    const onAbort = () => void conversion.cancel();
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      await conversion.execute();
    } catch (error) {
      if (signal?.aborted || error instanceof mb.ConversionCanceledError) {
        throw new CompressionCanceled();
      }
      return original;
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }

    const buffer = output.target.buffer;
    if (!buffer) return original;
    if (buffer.byteLength >= file.size && PASS_VIDEO_MIME.includes(file.type)) {
      return original;
    }

    onProgress?.(1);
    return {
      file: new File([buffer], rename(file.name, "mp4"), { type: "video/mp4" }),
      width,
      height,
      durationSeconds,
      originalBytes: file.size,
      compressed: true,
    };
  } catch (error) {
    if (error instanceof CompressionCanceled || error instanceof ProbeRefusal) throw error;
    // Unreadable container, a decoder that gave up: hand in the original.
    return original;
  } finally {
    input.dispose();
  }
}

/** Thrown when `onProbe` refuses the clip; carries the player-facing reason. */
export class ProbeRefusal extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ProbeRefusal";
  }
}

/* ============================================================== helpers */

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

function rename(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "hand-in";
  return `${base}.${ext}`;
}
