import type { Metadata } from "next";
import Link from "next/link";
import type {
  GalleryItem,
  GalleryTagWithCount,
  PaginatedShots,
} from "@/lib/api";
import { galleryPath } from "@/lib/gallery-url";
import { TILE_WIDTHS, imageSrcSet, imageUrl, orientedSize } from "@/lib/image";
import { serverApiBase, SITE_URL } from "@/lib/site";
import { shuffleCopy } from "@/lib/shuffle";
import { GALLERY_PAGE_SIZE, TILE_SIZES } from "./constants";
import { GalleryFilters } from "./gallery-filters";
import { GalleryGrid } from "./gallery-grid";

/** Stable mix so consecutive archive numbers don't sit together, without
 *  a per-visit reshuffle that would mismatch the SSR HTML. */
const GRID_SEED = 0x51e77f;

const EMPTY_PAGE: PaginatedShots = {
  items: [],
  total: 0,
  page: 1,
  pageSize: GALLERY_PAGE_SIZE,
  nextCursor: null,
};

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "The STIFF archive — worn, shot, kept. Lookbook photography and community shots from Tbilisi.",
  alternates: {
    canonical: "/gallery",
    // Discovery for readers and schedulers, which look in the head rather
    // than guessing a path.
    types: {
      "application/rss+xml": [
        { url: "/gallery/feed.xml", title: "STIFF Archive" },
      ],
      "application/feed+json": [
        { url: "/gallery/feed.json", title: "STIFF Archive" },
      ],
    },
  },
};

/** `?tag=` may arrive once, several times, or not at all. */
function tagsFrom(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

async function fetchShots(tags: string[]): Promise<PaginatedShots> {
  const query = new URLSearchParams({
    page: "1",
    pageSize: String(GALLERY_PAGE_SIZE),
  });
  for (const tag of tags) query.append("tag", tag);

  try {
    const res = await fetch(`${serverApiBase()}/gallery?${query}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return EMPTY_PAGE;
    return (await res.json()) as PaginatedShots;
  } catch {
    return EMPTY_PAGE;
  }
}

async function fetchTags(): Promise<GalleryTagWithCount[]> {
  try {
    const res = await fetch(`${serverApiBase()}/gallery/tags`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as GalleryTagWithCount[];
  } catch {
    return [];
  }
}

export default async function GalleryPage({
  searchParams,
}: PageProps<"/gallery">) {
  const { tag } = await searchParams;
  const active = tagsFrom(tag);

  const [data, tags] = await Promise.all([fetchShots(active), fetchTags()]);
  const shots = shuffleCopy(data.items, GRID_SEED);

  // The grid hydrates from this payload so the first photos are in the HTML
  // (and start downloading during parse) instead of waiting on client JS.
  //
  // Only the unfiltered archive is described as a gallery: a filtered view is
  // a slice of the same collection, and publishing each one as its own
  // ImageGallery would claim several galleries where there is one.
  const jsonLd =
    shots.length > 0 && active.length === 0
      ? {
          "@context": "https://schema.org",
          "@type": "ImageGallery",
          name: "STIFF Archive",
          description:
            "The STIFF archive — worn, shot, kept. Lookbook photography and community shots from Tbilisi.",
          url: `${SITE_URL}/gallery`,
          image: shots.map((shot: GalleryItem) => {
            const size = orientedSize(shot.width, shot.height, shot.rotation);
            return {
              "@type": "ImageObject",
              contentUrl: imageUrl(shot.imageUrl, 1600, "detail", shot.rotation),
              thumbnailUrl: imageUrl(shot.imageUrl, 400, "tile", shot.rotation),
              name: shot.title,
              caption: shot.altText ?? shot.description ?? undefined,
              width: size.width,
              height: size.height,
              url: `${SITE_URL}${galleryPath(shot)}`,
            };
          }),
        }
      : null;

  return (
    <section className="w-full px-4 py-12 sm:px-6 sm:py-16">
      {shots.slice(0, 4).map((shot, i) => (
        <link
          key={shot.id}
          rel="preload"
          as="image"
          href={imageUrl(shot.imageUrl, 640, "tile", shot.rotation)}
          imageSrcSet={
            imageSrcSet(shot.imageUrl, TILE_WIDTHS, "tile", shot.rotation) ||
            undefined
          }
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
        <Link
          href="/gallery/shoot"
          className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground"
        >
          By shoot →
        </Link>
      </div>

      <GalleryFilters tags={tags} active={active} />

      <GalleryGrid
        // A filter change is a different archive; remounting throws away the
        // old scroll instead of appending one list onto another.
        key={active.join(",")}
        initialItems={shots}
        initialTotal={data.total}
        initialCursor={data.nextCursor}
        filters={{ tag: active }}
      />
    </section>
  );
}
