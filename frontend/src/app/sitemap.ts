import type { MetadataRoute } from "next";
import { galleryPath } from "@/lib/gallery-url";
import { serverApiBase, SITE_URL } from "@/lib/site";

/** The API caps a page at 50 rows, so a full archive takes several requests. */
const PAGE_SIZE = 50;

/** Stops a runaway loop if the API ever reports a total it can't serve. */
const MAX_PAGES = 40;

interface ProductRow {
  slug: string;
  updatedAt: string;
}

interface GalleryRow {
  slug: string;
  title: string;
  createdAt: string;
}

interface Page<T> {
  items: T[];
  total: number;
}

/**
 * Walks every page of a listing endpoint. The sitemap used to stop at the
 * first 50 of each, which quietly left most of the archive out of it.
 */
async function fetchAll<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const res = await fetch(
      `${serverApiBase()}${path}${separator}page=${page}&pageSize=${PAGE_SIZE}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) break;
    const data = (await res.json()) as Page<T>;
    rows.push(...data.items);
    if (rows.length >= data.total || data.items.length === 0) break;
  }
  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    {
      url: `${SITE_URL}/clothing`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    { url: `${SITE_URL}/gallery`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/rules`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/search`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Live products and gallery shots — the sitemap degrades gracefully to the
  // static routes if the API is unreachable at build/revalidate time.
  try {
    const products = await fetchAll<ProductRow>("/products?sort=newest");
    for (const product of products) {
      entries.push({
        url: `${SITE_URL}/clothing/${product.slug}`,
        lastModified: new Date(product.updatedAt),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch {
    // API down — static routes only
  }

  try {
    const shots = await fetchAll<GalleryRow>("/gallery");
    for (const item of shots) {
      entries.push({
        url: `${SITE_URL}${galleryPath(item)}`,
        lastModified: new Date(item.createdAt),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch {
    // API down — static routes only
  }

  return entries;
}
