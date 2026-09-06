/**
 * What a player is allowed to hand in.
 *
 * Live streaming is off: every attempt on every day is a recording, captured
 * on the player's own phone and uploaded when the clock stops. A player picks
 * one of two shapes — a still or a clip — and the rules differ per shape, so
 * they are decided here rather than in three places that can drift.
 *
 * Kept pure and free of Nest so the limits can be tested directly. These are
 * the numbers a player will argue with ("it said two minutes"), and the answer
 * should not depend on reading a repository mock.
 */

export const ATTEMPT_KINDS = ['photo', 'video'] as const;
export type AttemptKind = (typeof ATTEMPT_KINDS)[number];

/**
 * A clip shorter than this is not an attempt, it is a slip of the thumb.
 * Five seconds is also long enough to carry a liveness challenge word.
 */
export const MIN_VIDEO_SECONDS = 5;

/**
 * Two minutes, and the phone records at delivery bitrate, so this is also the
 * cap on what the season costs to serve. See `docs/game/hosting.md`.
 */
export const MAX_VIDEO_SECONDS = 120;

/** 720p at ~1.5 Mbps is ~11 MB a minute; this leaves room and no more. */
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Days in a season. The ladder is three rungs — spec §04. */
export const SEASON_DAYS = [1, 2, 3] as const;
export type SeasonDay = (typeof SEASON_DAYS)[number];

export function isSeasonDay(value: unknown): value is SeasonDay {
  return (SEASON_DAYS as readonly unknown[]).includes(value);
}

export interface MediaClaim {
  kind: AttemptKind;
  mimeType: string;
  byteSize: number;
  /** Whole seconds. Required for a clip, meaningless for a still. */
  durationSeconds?: number | null;
}

export type MediaCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether this upload may be accepted.
 *
 * The browser reports duration and size before it uploads, so this runs twice:
 * once to decide whether to hand out an upload URL at all, and once when the
 * upload is confirmed. Both callers get the same answer from the same code —
 * a client that lies on the first call is caught on the second.
 */
export function checkMedia(claim: MediaClaim): MediaCheck {
  if (claim.kind === 'photo') return checkPhoto(claim);
  if (claim.kind === 'video') return checkVideo(claim);
  return { ok: false, reason: 'Choose a photo or a video.' };
}

function checkPhoto(claim: MediaClaim): MediaCheck {
  if (!PHOTO_MIME_TYPES.includes(claim.mimeType)) {
    return { ok: false, reason: 'Photos must be JPEG, PNG or WebP.' };
  }
  if (!isPositiveSize(claim.byteSize)) {
    return { ok: false, reason: 'That file is empty.' };
  }
  if (claim.byteSize > MAX_PHOTO_BYTES) {
    return { ok: false, reason: 'That photo is larger than 12 MB.' };
  }
  return { ok: true };
}

function checkVideo(claim: MediaClaim): MediaCheck {
  if (!VIDEO_MIME_TYPES.includes(claim.mimeType)) {
    return { ok: false, reason: 'Videos must be MP4, WebM or MOV.' };
  }
  if (!isPositiveSize(claim.byteSize)) {
    return { ok: false, reason: 'That file is empty.' };
  }
  if (claim.byteSize > MAX_VIDEO_BYTES) {
    return { ok: false, reason: 'That video is larger than 40 MB.' };
  }

  const duration = claim.durationSeconds;
  if (typeof duration !== 'number' || !Number.isFinite(duration)) {
    return { ok: false, reason: 'We could not read how long that video is.' };
  }
  // Rounded before comparing, so a 4.6-second clip the browser reports as
  // 4.6 counts as five rather than being refused for a rounding difference
  // the player cannot see or fix.
  const seconds = Math.round(duration);
  if (seconds < MIN_VIDEO_SECONDS) {
    return { ok: false, reason: 'Videos must be at least 5 seconds.' };
  }
  if (seconds > MAX_VIDEO_SECONDS) {
    return { ok: false, reason: 'Videos must be 2 minutes or shorter.' };
  }
  return { ok: true };
}

function isPositiveSize(bytes: number): boolean {
  return Number.isFinite(bytes) && bytes > 0;
}

/** The duration to store: whole seconds for a clip, null for a still. */
export function storedDuration(claim: MediaClaim): number | null {
  if (claim.kind !== 'video') return null;
  return typeof claim.durationSeconds === 'number'
    ? Math.round(claim.durationSeconds)
    : null;
}

/** The extension to give the stored object, from the type the browser sent. */
export function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[mimeType] ?? 'bin';
}
