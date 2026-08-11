/**
 * Builders for the share sheet's subject.
 *
 * Kept out of the "use client" component module so server components can call
 * them too — a plain function exported from a client module is replaced by a
 * client reference when imported across the boundary.
 */

import { galleryPath } from "./gallery-url";
import type { ShareSubject } from "./share-image";
import { SITE_URL } from "./site";

/** Absolute link for a gallery shot — the share sheet prints and shares it. */
export function galleryShareSubject(item: {
  title: string;
  imageUrl: string;
  description?: string | null;
}): ShareSubject {
  return {
    title: item.title,
    imageUrl: item.imageUrl,
    caption: item.description ?? null,
    url: `${SITE_URL}${galleryPath(item)}`,
  };
}

/**
 * Same treatment for a product. Products carry several images; the share card
 * uses the first, which is the one the grid and detail hero already lead with.
 * Returns null when there is no image to compose a card from — callers hide
 * the button in that case.
 */
export function productShareSubject(product: {
  name: string;
  slug: string;
  images: string[];
  description?: string | null;
}): ShareSubject | null {
  const image = product.images[0];
  if (!image) return null;
  return {
    title: product.name,
    imageUrl: image,
    caption: product.description ?? null,
    url: `${SITE_URL}/clothing/${encodeURIComponent(product.slug)}`,
    kicker: "Tbilisi — essential clothing",
  };
}
