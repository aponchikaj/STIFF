"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { galleryApi } from "@/lib/api";
import type { GalleryItem } from "@/lib/api";
import { galleryPath } from "@/lib/gallery-url";
import { errorMessage } from "@/lib/hooks";
import { ErrorNote, Loading } from "@/components/ui";
import { ProductImage } from "@/components/product-image";
import { ShareButton } from "@/components/share-button";
import { galleryShareSubject } from "@/lib/share-subject";
import { shuffleCopy } from "@/lib/shuffle";
import { GALLERY_PAGE_SIZE, TILE_SIZES } from "./constants";

/** Roughly the first viewport of tiles; these skip lazy-loading. */
const EAGER_TILES = 6;

const GalleryTile = memo(function GalleryTile({
  item,
  priority,
}: {
  item: GalleryItem;
  priority: boolean;
}) {
  return (
    <div className="group relative mb-4 break-inside-avoid">
      {/* The share button is a sibling of the link, not a child — a
          button inside an anchor is invalid and swallows the click. */}
      <Link
        href={galleryPath(item)}
        className="block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
      >
        <figure>
          <ProductImage
            src={item.imageUrl}
            alt={item.altText ?? item.title}
            aspect=""
            width={item.width}
            height={item.height}
            rotation={item.rotation}
            sizes={TILE_SIZES}
            priority={priority}
          />
          <figcaption className="mt-2 flex items-baseline justify-between gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
            <span className="truncate">{item.title}</span>
            <span className="shrink-0">
              {item.likeCount > 0 ? `${item.likeCount} ♥` : ""}
            </span>
          </figcaption>
        </figure>
      </Link>
      {/* Always reachable on touch, revealed on hover on pointer
          devices, and always shown once focused. */}
      <ShareButton
        subject={galleryShareSubject(item)}
        variant="icon"
        className="absolute right-2 top-2 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-[1024px]:opacity-100"
      />
    </div>
  );
});

export function GalleryGrid({
  initialItems = [],
  initialTotal = 0,
}: {
  initialItems?: GalleryItem[];
  initialTotal?: number;
}) {
  const [items, setItems] = useState<GalleryItem[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialItems.length > 0 ? 1 : 0);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  // One seed per visit so a re-render doesn't reshuffle tiles already on screen.
  const [visitSeed] = useState(() => (Math.random() * 0xffffffff) | 0 || 1);

  const loadPage = useCallback(
    async (next: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await galleryApi.listGallery({
          page: next,
          pageSize: GALLERY_PAGE_SIZE,
        });
        // Shuffle only the incoming page, then append. Already-visible tiles
        // stay put; consecutive archive numbers (0001, 0002) stop sitting
        // next to each other. Page 1 arrives pre-shuffled from the server.
        const pageSeed = visitSeed ^ Math.imul(next, 0x9e3779b9);
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          const incoming = res.items.filter((i) => !seen.has(i.id));
          return [
            ...prev,
            ...(next === 1 ? incoming : shuffleCopy(incoming, pageSeed)),
          ];
        });
        setTotal(res.total);
        setPage(next);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [visitSeed],
  );

  useEffect(() => {
    if (initialItems.length > 0) return;
    void loadPage(1);
  }, [initialItems.length, loadPage]);

  const hasMore = items.length < total;

  // Pull the next page in as the sentinel nears the viewport, so scrolling
  // never stalls on a click.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadPage(page + 1);
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, page, loadPage]);

  if (loading && items.length === 0) return <Loading label="Loading gallery" />;
  if (error && items.length === 0) return <ErrorNote message={error} />;

  if (items.length === 0) {
    return (
      <p className="mt-12 max-w-md text-sm leading-7 text-muted">
        Nothing here yet — the first shoot is on its way. Follow{" "}
        <a
          href="https://www.instagram.com/stiff__________/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[2px] font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
        >
          @stiff__________
        </a>{" "}
        to see it first.
      </p>
    );
  }

  return (
    <>
      <div className="mt-10 columns-2 gap-4 sm:mt-12 sm:columns-3 lg:columns-4 xl:columns-5">
        {items.map((item, i) => (
          <GalleryTile
            key={item.id}
            item={item}
            priority={i < EAGER_TILES}
          />
        ))}
      </div>

      <div ref={sentinel} aria-hidden="true" className="h-px" />

      {error && <ErrorNote message={error} />}

      <p
        aria-live="polite"
        className="mt-8 text-center text-[10px] font-medium uppercase tracking-[0.25em] text-muted"
      >
        {loading
          ? "Loading…"
          : hasMore
            ? `${items.length} of ${total}`
            : `${total} shots — that's all of it`}
      </p>
    </>
  );
}
