/**
 * Photographs, baked.
 *
 * These are real rows from the shop's gallery archive, pulled once from
 * `GET /api/gallery` on the hosted API and written down here rather than
 * fetched at runtime. Two reasons: the journal stays a static build with no
 * backend to be down, and the backend's CORS allowlist in
 * `backend/src/configure-app.ts` does not include this app's origin anyway.
 *
 * `src` is the stored Cloudinary secure_url -- a full-size original. Never
 * render it directly; put it through `imageUrl()` / `imageSrcSet()` from
 * `@/lib/image`, which is what turns a 465 KB original into a 29 KB plate.
 *
 * `alt` is written by hand. Every row in the archive has `altText: null`,
 * so there is nothing to inherit.
 */

export interface Plate {
  id: string;
  src: string;
  width: number;
  height: number;
  /** Clockwise degrees the stored file needs turning. Honour it or the
      photograph renders on its side. */
  rotation: number;
  alt: string;
}

export const PLATES: Record<string, Plate> = {
  "0035": {
    id: "0035",
    src: "https://res.cloudinary.com/dxhdvproq/image/upload/v1786435293/stiff/ur0fsvoz478vyfohpoq8.jpg",
    width: 1600,
    height: 2400,
    rotation: 0,
    alt: "A figure in a heavy fur coat crouched beside the front wheel of a Shelby Cobra at night, STIFF lettering visible across the chest.",
  },
  "0036": {
    id: "0036",
    src: "https://res.cloudinary.com/dxhdvproq/image/upload/v1786435293/stiff/mctfjwawlyucy8zz6gzu.jpg",
    width: 2400,
    height: 1600,
    rotation: 0,
    alt: "The Cobra in full profile under floodlight, twin racing stripes running the length of the body, a figure standing at the rear wheel.",
  },
  "0048": {
    id: "0048",
    src: "https://res.cloudinary.com/dxhdvproq/image/upload/v1786435297/stiff/nvxuwtap3wlqeortcbsa.jpg",
    width: 2400,
    height: 1600,
    rotation: 0,
    alt: "Two figures leaning over the black hood of a Mercedes 190 SL, the star badge and script centred between them.",
  },
  "0049": {
    id: "0049",
    src: "https://res.cloudinary.com/dxhdvproq/image/upload/v1786435298/stiff/a6bp0jxmgu8x9mufmfpm.jpg",
    width: 1600,
    height: 2400,
    rotation: 0,
    alt: "The 190 SL badge alone on a black hood, a treeline above it, almost abstract.",
  },
  "0052": {
    id: "0052",
    src: "https://res.cloudinary.com/dxhdvproq/image/upload/v1786435299/stiff/k1fs7iy6jsfhsolhs32g.jpg",
    width: 2400,
    height: 1600,
    rotation: 0,
    alt: "Two figures seated in an open convertible, one in a STIFF hooded sweatshirt, the windscreen frame cutting across the picture.",
  },
};
