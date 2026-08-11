/**
 * Cloudinary delivery helpers.
 *
 * Uploads are stored untouched (see backend UploadsService) — originals run to
 * several MB. Nothing should ever ship the original to a browser: every render
 * goes through `imageUrl`/`imageSrcSet`, which inject a transformation segment
 * so Cloudinary resizes and re-encodes on its CDN.
 *
 *   .../image/upload/v123/stiff/abc.jpg
 *   .../image/upload/f_auto,q_auto,c_limit,w_800/v123/stiff/abc.jpg
 *
 * `f_auto` picks AVIF/WebP per browser, `q_auto` picks a quality that holds up
 * for the content, `c_limit` never upscales past the original.
 *
 * URLs that aren't Cloudinary (local /uploads fallback, external) pass through
 * untouched, so every call site is safe regardless of where the image lives.
 */

const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/** Widths offered to the browser; it picks one using the `sizes` hint. */
export const IMAGE_WIDTHS = [320, 480, 640, 800, 1080, 1400, 1920] as const;

/** Small enough to decode instantly, large enough to survive a 2x thumbnail. */
export const THUMB_WIDTH = 320;

export function isCloudinary(src: string): boolean {
  return CLOUDINARY_UPLOAD.test(src);
}

/** Returns `src` resized to `width`, or `src` unchanged if it isn't Cloudinary. */
export function imageUrl(src: string, width: number): string {
  const match = CLOUDINARY_UPLOAD.exec(src);
  if (!match) return src;
  const [, base, rest] = match;
  return `${base}f_auto,q_auto,c_limit,w_${width}/${rest}`;
}

/** Candidate set for the `srcset` attribute; empty string when not applicable. */
export function imageSrcSet(
  src: string,
  widths: readonly number[] = IMAGE_WIDTHS,
): string {
  if (!isCloudinary(src)) return "";
  return widths.map((w) => `${imageUrl(src, w)} ${w}w`).join(", ");
}

/**
 * Tiny blurred stand-in used behind an image while it decodes. Cheap enough
 * (~1KB) to be worth a request, and it makes the grid feel instant.
 */
export function imageBlurUrl(src: string): string | null {
  const match = CLOUDINARY_UPLOAD.exec(src);
  if (!match) return null;
  const [, base, rest] = match;
  return `${base}f_auto,q_auto:low,c_limit,w_24,e_blur:400/${rest}`;
}
