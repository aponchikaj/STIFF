import { apiFetch } from "./client";
import type {
  GalleryItem,
  GalleryItemDetail,
  GalleryListParams,
  GalleryTagWithCount,
  PaginatedShots,
  Paginated,
  ShootDetail,
  ShootSummary,
} from "./types";

export function listGallery(
  params?: GalleryListParams,
): Promise<PaginatedShots> {
  return apiFetch("/gallery", { query: { ...params } });
}

/** `slug` is the stable gallery URL slug; a raw UUID also resolves. */
export function getGalleryItem(slug: string): Promise<GalleryItemDetail> {
  return apiFetch(`/gallery/${encodeURIComponent(slug)}`);
}

export function listShoots(): Promise<ShootSummary[]> {
  return apiFetch("/gallery/shoots");
}

export function getShoot(slug: string): Promise<ShootDetail> {
  return apiFetch(`/gallery/shoots/${encodeURIComponent(slug)}`);
}

/**
 * Tags that actually have shots behind them.
 *
 * Empty tags are the admin's to tidy; a filter guaranteed to return nothing
 * is worse than no filter.
 */
export function listTags(): Promise<GalleryTagWithCount[]> {
  return apiFetch("/gallery/tags");
}

/** Kept for callers that only need the shape, not the cursor. */
export type GalleryPage = Paginated<GalleryItem>;
