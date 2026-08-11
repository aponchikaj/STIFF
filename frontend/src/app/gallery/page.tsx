import type { Metadata } from "next";
import type { GalleryItem, Paginated } from "@/lib/api";
import { galleryPath } from "@/lib/gallery-url";
import { imageUrl } from "@/lib/image";
import { serverApiBase, SITE_URL } from "@/lib/site";
import { Reveal } from "@/components/motion";
import { GalleryGrid } from "./gallery-grid";

/** Enough shots to describe the collection without shipping a huge blob. */
const JSON_LD_SHOTS = 24;

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "The STIFF archive — worn, shot, kept. Lookbook photography and community shots from Tbilisi.",
  alternates: { canonical: "/gallery" },
};

async function fetchShots(): Promise<GalleryItem[]> {
  try {
    const res = await fetch(
      `${serverApiBase()}/gallery?pageSize=${JSON_LD_SHOTS}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as Paginated<GalleryItem>;
    return data.items;
  } catch {
    return [];
  }
}

export default async function GalleryPage() {
  const shots = await fetchShots();

  // The grid itself is client-rendered and paginated, so a crawler that
  // doesn't run JavaScript would otherwise see an empty page. This describes
  // the collection and every image in the first page of it.
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
            contentUrl: imageUrl(shot.imageUrl, 1600),
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
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <Reveal className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
          Gallery
        </h1>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          The archive
        </p>
      </Reveal>
      <GalleryGrid />
    </section>
  );
}
