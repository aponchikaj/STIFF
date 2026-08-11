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

/** `slug` is the shot's title (0001); a raw UUID also resolves. */
export function getGalleryItem(slug: string): Promise<GalleryItemDetail> {
  return apiFetch(`/gallery/${encodeURIComponent(slug)}`);
}
