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

export function getGalleryItem(id: string): Promise<GalleryItemDetail> {
  return apiFetch(`/gallery/${id}`);
}
