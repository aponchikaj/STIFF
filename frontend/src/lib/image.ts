/**
 * Cloudinary delivery helpers.
 *
 * Uploads are stored untouched (see backend UploadsService) — originals run to
 * several MB. Nothing should ever ship the original to a browser: every render
 * goes through `imageUrl`/`imageSrcSet`, which inject a transformation segment
 * so Cloudinary resizes and re-encodes on its CDN.
 *
 *   .../image/upload/v123/stiff/abc.jpg
 *   .../image/upload/f_auto,q_auto:eco,c_limit,w_800/v123/stiff/abc.jpg
 *
 * `f_auto` picks AVIF/WebP per browser. `q_auto:eco` (tiles) and `q_auto:good`
 * (detail) trade a little quality for a lot of bytes. `c_limit` never upscales.
 *
 * URLs that aren't Cloudinary (local /uploads fallback, external) pass through
 * untouched, so every call site is safe regardless of where the image lives.
 */

const CLOUDINARY_UPLOAD =
  /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/** Grid / card slots — a 20vw tile never needs a 1920px file. */
export const TILE_WIDTHS = [320, 480, 640, 800, 1080] as const;

/** Stage, lightbox, Open Graph — covers a 2x laptop and most phones. */
export const DETAIL_WIDTHS = [800, 1080, 1400, 1920] as const;

/** @deprecated Use TILE_WIDTHS or DETAIL_WIDTHS. Kept as the tile set. */
export const IMAGE_WIDTHS = TILE_WIDTHS;

/** Small enough to decode instantly, large enough to survive a 2x thumbnail. */
export const THUMB_WIDTH = 320;

export type ImageFit = "tile" | "detail";

const TRANSFORM: Record<ImageFit, string> = {
  tile: "f_auto,q_auto:eco,c_limit",
  detail: "f_auto,q_auto:good,c_limit",
};

export function isCloudinary(src: string): boolean {
  return CLOUDINARY_UPLOAD.test(src);
}

/** Returns `src` resized to `width`, or `src` unchanged if it isn't Cloudinary. */
export function imageUrl(
  src: string,
  width: number,
  fit: ImageFit = "tile",
): string {
  const match = CLOUDINARY_UPLOAD.exec(src);
  if (!match) return src;
  const [, base, rest] = match;
  return `${base}${TRANSFORM[fit]},w_${width}/${rest}`;
}

/** Candidate set for the `srcset` attribute; empty string when not applicable. */
export function imageSrcSet(
  src: string,
  widths: readonly number[] = TILE_WIDTHS,
  fit: ImageFit = "tile",
): string {
  if (!isCloudinary(src)) return "";
  return widths.map((w) => `${imageUrl(src, w, fit)} ${w}w`).join(", ");
}

/**
 * Tiny blurred stand-in used behind an image while it decodes. Cheap enough
 * (~1KB) to be worth a request on a single hero, but a grid of these fights
 * the real photos for bandwidth — skip it on lists.
 */
export function imageBlurUrl(src: string): string | null {
  const match = CLOUDINARY_UPLOAD.exec(src);
  if (!match) return null;
  const [, base, rest] = match;
  return `${base}f_auto,q_auto:low,c_limit,w_24,e_blur:400/${rest}`;
}
