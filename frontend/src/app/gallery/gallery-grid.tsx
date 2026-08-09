"use client";

import Link from "next/link";
import { galleryApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { AsteriskMark } from "@/components/asterisk-mark";
import { Reveal } from "@/components/motion";
import { ErrorNote, Loading } from "@/components/ui";
import { ProductImage } from "@/components/product-image";

// Varied aspect ratios keep the placeholder grid alive until photos land.
const PLACEHOLDER_ASPECTS = [
  "aspect-[3/4]",
  "aspect-square",
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-square",
  "aspect-[3/4]",
];

export function GalleryGrid() {
  const { data, loading, error } = useAsync(
    () => galleryApi.listGallery({ pageSize: 30 }),
    [],
  );

  if (loading) return <Loading label="Loading gallery" />;
  if (error) return <ErrorNote message={error} />;

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="mt-10 columns-2 gap-4 sm:mt-12 sm:columns-3 lg:columns-4 xl:columns-5">
        {PLACEHOLDER_ASPECTS.map((aspect, i) => (
          <Reveal key={i} delay={(i % 3) * 0.06} className="mb-4 break-inside-avoid">
            <figure>
              <div className={`flex ${aspect} items-center justify-center bg-surface`}>
                <AsteriskMark className="size-8 text-subtle" />
              </div>
              <figcaption className="mt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                00{i + 1}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-10 columns-2 gap-4 sm:mt-12 sm:columns-3 lg:columns-4 xl:columns-5">
      {items.map((item, i) => (
        <Reveal key={item.id} delay={(i % 3) * 0.06} className="mb-4 break-inside-avoid">
          <Link
            href={`/gallery/${item.id}`}
            className="group block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            <figure>
              <ProductImage
                src={item.imageUrl}
                alt={item.title}
                aspect=""
                className="transition-opacity group-hover:opacity-90"
              />
              <figcaption className="mt-2 flex items-baseline justify-between gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                <span className="truncate">{item.title}</span>
                <span className="shrink-0">
                  {item.likeCount > 0 ? `${item.likeCount} ♥` : ""}
                </span>
              </figcaption>
            </figure>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}
