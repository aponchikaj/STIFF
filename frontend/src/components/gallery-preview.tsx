"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { galleryApi } from "@/lib/api";
import type { GalleryItem } from "@/lib/api";
import { galleryPath } from "@/lib/gallery-url";
import { useAsync } from "@/lib/hooks";
import { shuffleCopy } from "@/lib/shuffle";
import { ScaleIn } from "./motion";
import { ProductImage } from "./product-image";

/** Pull a pool, then pick a handful so consecutive archive numbers rarely sit together. */
const POOL_SIZE = 32;
const PREVIEW_COUNT = 6;

function isLandscape(item: GalleryItem): boolean {
  return (item.width ?? 0) > (item.height ?? 0);
}

function pickPreview(items: GalleryItem[], seed: number): GalleryItem[] {
  if (items.length === 0) return [];
  const mixed = shuffleCopy(items, seed);
  const featured = mixed.find(isLandscape) ?? mixed[0];
  if (!featured) return [];
  const rest = mixed.filter((item) => item.id !== featured.id).slice(0, PREVIEW_COUNT - 1);
  return [featured, ...rest];
}

/** Randomized archive strip for the home page; renders nothing while empty. */
export function GalleryPreview() {
  const { data, loading } = useAsync(
    () => galleryApi.listGallery({ pageSize: POOL_SIZE }),
    [],
  );
  const [seed] = useState(() => (Math.random() * 0xffffffff) | 0 || 1);

  const items = useMemo(
    () => pickPreview(data?.items ?? [], seed),
    [data, seed],
  );

  if (loading && items.length === 0) {
    return (
      <div
        aria-hidden="true"
        className="mt-10 grid grid-cols-2 items-start gap-4 lg:grid-cols-4"
      >
        <div className="col-span-2 aspect-[3/2] animate-pulse bg-surface" />
        <div className="aspect-[3/4] animate-pulse bg-surface" />
        <div className="aspect-[3/4] animate-pulse bg-surface" />
        <div className="aspect-[3/4] animate-pulse bg-surface" />
        <div className="aspect-[3/4] animate-pulse bg-surface" />
        <div className="aspect-[3/4] animate-pulse bg-surface" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <ul className="mt-10 grid grid-cols-2 items-start gap-4 lg:grid-cols-4">
      {items.map((item, i) => {
        const featured = i === 0;
        return (
          <li key={item.id} className={featured ? "col-span-2" : "min-w-0"}>
            <ScaleIn delay={i * 0.05}>
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
                    sizes={
                      featured
                        ? "(min-width: 1024px) 50vw, 100vw"
                        : "(min-width: 1024px) 25vw, 50vw"
                    }
                    priority={featured}
                    className="transition-opacity duration-200 group-hover:opacity-90"
                  />
                  <figcaption className="mt-2 truncate text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                    {item.title}
                  </figcaption>
                </figure>
              </Link>
            </ScaleIn>
          </li>
        );
      })}
    </ul>
  );
}
