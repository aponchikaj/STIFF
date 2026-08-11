import type { MetadataRoute } from "next";
import { galleryPath } from "@/lib/gallery-url";
import { serverApiBase, SITE_URL } from "@/lib/site";

interface ProductRow {
  slug: string;
  updatedAt: string;
}

interface GalleryRow {
  /** Doubles as the URL slug — see galleryPath. */
  title: string;
  createdAt: string;
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
  ];

  // Live products and gallery shots — the sitemap degrades gracefully to the
  // static routes if the API is unreachable at build/revalidate time.
  try {
    const res = await fetch(
      `${serverApiBase()}/products?pageSize=50&sort=newest`,
      { next: { revalidate: 3600 } },
    );
    if (res.ok) {
      const data = (await res.json()) as { items: ProductRow[] };
      for (const product of data.items) {
        entries.push({
          url: `${SITE_URL}/clothing/${product.slug}`,
          lastModified: new Date(product.updatedAt),
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch {
    // API down — static routes only
  }

  try {
    const res = await fetch(`${serverApiBase()}/gallery?pageSize=50`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = (await res.json()) as { items: GalleryRow[] };
      for (const item of data.items) {
        entries.push({
          url: `${SITE_URL}${galleryPath(item)}`,
          lastModified: new Date(item.createdAt),
          changeFrequency: "monthly",
          priority: 0.5,
        });
      }
    }
  } catch {
    // API down — static routes only
  }

  return entries;
}
