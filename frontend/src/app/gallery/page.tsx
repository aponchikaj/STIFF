import type { Metadata } from "next";
import type { GalleryItem, Paginated } from "@/lib/api";
import { galleryPath } from "@/lib/gallery-url";
import { TILE_WIDTHS, imageSrcSet, imageUrl } from "@/lib/image";
import { serverApiBase, SITE_URL } from "@/lib/site";
import { shuffleCopy } from "@/lib/shuffle";
import { GALLERY_PAGE_SIZE, TILE_SIZES } from "./constants";
import { GalleryGrid } from "./gallery-grid";

/** Stable mix so consecutive archive numbers don't sit together, without
 *  a per-visit reshuffle that would mismatch the SSR HTML. */
const GRID_SEED = 0x51e77f;

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "The STIFF archive — worn, shot, kept. Lookbook photography and community shots from Tbilisi.",
  alternates: { canonical: "/gallery" },
};

async function fetchShots(): Promise<Paginated<GalleryItem>> {
  try {
    const res = await fetch(
      `${serverApiBase()}/gallery?page=1&pageSize=${GALLERY_PAGE_SIZE}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) {
      return { items: [], total: 0, page: 1, pageSize: GALLERY_PAGE_SIZE };
    }
    return (await res.json()) as Paginated<GalleryItem>;
  } catch {
    return { items: [], total: 0, page: 1, pageSize: GALLERY_PAGE_SIZE };
  }
}

export default async function GalleryPage() {
  const data = await fetchShots();
  const shots = shuffleCopy(data.items, GRID_SEED);

  // The grid hydrates from this payload so the first photos are in the HTML
  // (and start downloading during parse) instead of waiting on client JS.
  const jsonLd =
    shots.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ImageGallery",
          name: "STIFF Archive",
          description:
            "The STIFF archive — worn, shot, kept. Lookbook photography and community shots from Tbilisi.",
          url: `${SITE_URL}/gallery`,
          image: shots.map((shot) => ({
            "@type": "ImageObject",
            contentUrl: imageUrl(shot.imageUrl, 1600, "detail"),
            thumbnailUrl: imageUrl(shot.imageUrl, 400),
            name: shot.title,
            caption: shot.altText ?? shot.description ?? undefined,
            width: shot.width ?? undefined,
            height: shot.height ?? undefined,
            url: `${SITE_URL}${galleryPath(shot)}`,
          })),
        }
      : null;

  return (
    <section className="w-full px-4 py-12 sm:px-6 sm:py-16">
      {shots.slice(0, 4).map((shot, i) => (
        <link
          key={shot.id}
          rel="preload"
          as="image"
          href={imageUrl(shot.imageUrl, 640)}
          imageSrcSet={imageSrcSet(shot.imageUrl, TILE_WIDTHS) || undefined}
          imageSizes={TILE_SIZES}
          fetchPriority={i < 2 ? "high" : "auto"}
        />
      ))}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
          Gallery
        </h1>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          The archive
        </p>
      </div>
      <GalleryGrid initialItems={shots} initialTotal={data.total} />
    </section>
  );
}
