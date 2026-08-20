"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { galleryApi } from "@/lib/api";
import type { GalleryItem, GalleryListParams } from "@/lib/api";
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
            blurDataUrl={item.blurDataUrl}
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
  initialCursor = null,
  filters,
}: {
  initialItems?: GalleryItem[];
  initialTotal?: number;
  /** From the server-rendered first page; null means there was only one. */
  initialCursor?: string | null;
  /** Whatever the URL is filtering by. Changing it starts a fresh scroll. */
  filters?: Pick<GalleryListParams, "tag" | "shoot">;
}) {
  const [items, setItems] = useState<GalleryItem[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  // One seed per visit so a re-render doesn't reshuffle tiles already on screen.
  const [visitSeed] = useState(() => (Math.random() * 0xffffffff) | 0 || 1);
  const pagesLoaded = useRef(0);

  const loadMore = useCallback(
    async (from: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const res = await galleryApi.listGallery({
          pageSize: GALLERY_PAGE_SIZE,
          ...filters,
          // Keyset rather than an offset: the archive is reordered from the
          // admin panel, and an offset taken before a reorder points at a
          // different photograph after it.
          ...(from ? { cursor: from } : {}),
        });
        pagesLoaded.current += 1;
        // Shuffle only the incoming page, then append. Already-visible tiles
        // stay put; consecutive archive numbers (0001, 0002) stop sitting
        // next to each other. Page 1 arrives pre-shuffled from the server.
        const pageSeed = visitSeed ^ Math.imul(pagesLoaded.current, 0x9e3779b9);
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          const incoming = res.items.filter((i) => !seen.has(i.id));
          return [...prev, ...shuffleCopy(incoming, pageSeed)];
        });
        setTotal(res.total);
        setCursor(res.nextCursor);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [filters, visitSeed],
  );

  // Only when the server had nothing to hand over. A filter change arrives as
  // a remount (the page keys this component on the filters), which is a
  // cleaner way to start a fresh scroll than reconciling one list into
  // another — there is no state left over to reconcile.
  const started = useRef(initialItems.length > 0);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void loadMore(null);
  }, [loadMore]);

  const hasMore = cursor !== null;

  // Pull the next page in as the sentinel nears the viewport, so scrolling
  // never stalls on a click.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore(cursor);
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, cursor, loadMore]);

  if (loading && items.length === 0) return <Loading label="Loading gallery" />;
  if (error && items.length === 0) return <ErrorNote message={error} />;

  if (items.length === 0) {
    const filtered = (filters?.tag?.length ?? 0) > 0 || Boolean(filters?.shoot);
    return (
      <p className="mt-12 max-w-md text-sm leading-7 text-muted">
        {filtered ? (
          "Nothing in the archive matches all of those at once. Drop a filter."
        ) : (
          <>
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
          </>
        )}
      </p>
    );
  }

  return (
    <>
      <div className="mt-10 columns-2 gap-4 sm:mt-12 sm:columns-3 lg:columns-4 xl:columns-5">
        {items.map((item, i) => (
          <GalleryTile key={item.id} item={item} priority={i < EAGER_TILES} />
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
            : `${total} shot${total === 1 ? "" : "s"} — that's all of it`}
      </p>
    </>
  );
}
