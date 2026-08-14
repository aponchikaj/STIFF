export const KEBURIA_SLUG = 'keburia';
export const KEBURIA_TITLE = 'STIFF × KEBURIA';
export const DEFAULT_MAX_CODES = 300;
/** Hard ceiling so an admin typo cannot mint tens of thousands of codes. */
export const HARD_MAX_CODES = 2000;

/** Long enough to watch the film; short enough that a stolen laptop ages out. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Signed Cloudinary URLs die quickly so a copied network URL goes stale. */
export const PLAYBACK_TTL_SEC = 90;

export const COLLAB_SESSION_COOKIE = 'stiff_collab';

export const PRIVATE_MEDIA_DIR = 'private-media';

export type CollabCodeStatus = 'unused' | 'claimed' | 'revoked';
export type CollabVideoProvider = 'cloudinary' | 'local';
