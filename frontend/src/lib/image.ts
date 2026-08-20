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
 *   .../image/upload/a_270/f_auto,q_auto:eco,c_limit,w_800/v123/stiff/abc.jpg
 *
 * `a_90` / `a_180` / `a_270` is chained *before* the resize so a sideways
 * phone upload is turned upright first, then limited to the requested width.
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

/** Clockwise degrees. 0 means the stored pixels are already upright. */
export type ImageRotation = 0 | 90 | 180 | 270;

export function asRotation(value: number | null | undefined): ImageRotation {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}

/** Swap width/height when the delivery rotation is a quarter turn. */
export function orientedSize(
  width: number | null | undefined,
  height: number | null | undefined,
  rotation: number | null | undefined,
): { width?: number; height?: number } {
  const w = width ?? undefined;
  const h = height ?? undefined;
  if (rotation === 90 || rotation === 270) return { width: h, height: w };
  return { width: w, height: h };
}

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
  rotation: number = 0,
): string {
  const match = CLOUDINARY_UPLOAD.exec(src);
  if (!match) return src;
  const [, base, rest] = match;
  const angle =
    rotation === 90 || rotation === 180 || rotation === 270
      ? `a_${rotation}/`
      : "";
  return `${base}${angle}${TRANSFORM[fit]},w_${width}/${rest}`;
}

/** Candidate set for the `srcset` attribute; empty string when not applicable. */
export function imageSrcSet(
  src: string,
  widths: readonly number[] = TILE_WIDTHS,
  fit: ImageFit = "tile",
  rotation: number = 0,
): string {
  if (!isCloudinary(src)) return "";
  return widths.map((w) => `${imageUrl(src, w, fit, rotation)} ${w}w`).join(", ");
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

/**
 * Wallpaper crops.
 *
 * A phone screen is roughly 9:19.5 and a photograph is 3:4, so this is a crop,
 * not a resize — `g_auto` lets Cloudinary decide what to keep rather than
 * taking the middle and cutting off a head.
 *
 * `fl_attachment` sets `Content-Disposition: attachment`, which is what makes
 * a plain link download instead of navigating. The `download` attribute cannot
 * do this: browsers ignore it cross-origin, and the images live on Cloudinary.
 */
export const WALLPAPER_SIZES = [
  { label: "Phone", width: 1170, height: 2532 },
  { label: "Phone XL", width: 1290, height: 2796 },
  { label: "Desktop", width: 2560, height: 1440 },
] as const;

export type WallpaperSize = (typeof WALLPAPER_SIZES)[number];

/** Null when the image isn't on Cloudinary and so can't be cropped for one. */
export function wallpaperUrl(
  src: string,
  size: WallpaperSize,
  filename: string,
  rotation: number = 0,
): string | null {
  const match = CLOUDINARY_UPLOAD.exec(src);
  if (!match) return null;
  const [, base, rest] = match;
  const angle =
    rotation === 90 || rotation === 180 || rotation === 270
      ? `a_${rotation}/`
      : "";
  // The filename reaches a Content-Disposition header, so it is reduced to
  // characters that cannot terminate one.
  const safeName =
    filename
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "stiff";
  return `${base}${angle}c_fill,g_auto,w_${size.width},h_${size.height},f_jpg,q_auto:good,fl_attachment:${safeName}/${rest}`;
}
