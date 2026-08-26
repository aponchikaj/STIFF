import { apiFetch } from "./client";
import type {
  GalleryItem,
  GalleryItemDetail,
  GalleryListParams,
  Paginated,
} from "./types";

export function listGallery(
  params?: GalleryListParams,
): Promise<Paginated<GalleryItem>> {
  return apiFetch("/gallery", { query: { ...params } });
}

/** `slug` is the stable gallery URL slug; a raw UUID also resolves. */
export function getGalleryItem(slug: string): Promise<GalleryItemDetail> {
  return apiFetch(`/gallery/${encodeURIComponent(slug)}`);
}
