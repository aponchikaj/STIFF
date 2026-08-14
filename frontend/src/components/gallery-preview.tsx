"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { galleryApi } from "@/lib/api";
import type { GalleryItem } from "@/lib/api";
import { galleryPath } from "@/lib/gallery-url";
import { useAsync } from "@/lib/hooks";
import { shuffleCopy } from "@/lib/shuffle";
import { ProductImage } from "./product-image";

/** Pull a pool, then pick a handful so consecutive archive numbers rarely sit together. */
const POOL_SIZE = 32;
const PREVIEW_COUNT = 10;

/** Matches the `columns-*` classes below. */
const PREVIEW_SIZES =
  "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

/** Randomized archive strip for the home page; renders nothing while empty.
 *
 *  CSS columns, not a grid: shots keep their native ratio (wide, tall, small)
 *  and pack against each other instead of sharing a row height that leaves
 *  holes next to portraits. */
export function GalleryPreview() {
  const { data, loading } = useAsync(
    () => galleryApi.listGallery({ pageSize: POOL_SIZE }),
    [],
  );
  const [seed] = useState(() => (Math.random() * 0xffffffff) | 0 || 1);

  const items = useMemo(() => {
    const pool = data?.items ?? [];
    if (pool.length === 0) return [];
    return shuffleCopy(pool, seed).slice(0, PREVIEW_COUNT);
  }, [data, seed]);

  if (loading && items.length === 0) {
    return (
      <div
        aria-hidden="true"
        className="mt-10 columns-2 gap-2 sm:columns-3 lg:columns-4"
      >
        {[
          "aspect-[3/4]",
          "aspect-[3/2]",
          "aspect-[4/5]",
          "aspect-square",
          "aspect-[2/3]",
          "aspect-[5/4]",
        ].map((ratio, i) => (
          <div
            key={i}
            className={`mb-2 break-inside-avoid animate-pulse bg-surface ${ratio}`}
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <ul className="mt-10 columns-2 gap-2 sm:columns-3 lg:columns-4">
      {items.map((item) => (
        <li key={item.id} className="mb-2 break-inside-avoid">
          <Link
            href={galleryPath(item)}
            className="group block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            <figure>
              <ProductImage
                src={item.imageUrl}
                alt={item.altText ?? item.title}
                aspect=""
                width={item.width}
                height={item.height}
                rotation={item.rotation}
                sizes={PREVIEW_SIZES}
                className="transition-opacity duration-200 group-hover:opacity-90"
              />
              <figcaption className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                {item.title}
              </figcaption>
            </figure>
          </Link>
        </li>
      ))}
    </ul>
  );
}
