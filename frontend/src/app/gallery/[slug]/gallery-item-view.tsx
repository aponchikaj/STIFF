"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { galleryApi } from "@/lib/api";
import type { GalleryItem, GalleryItemDetail } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { galleryPath } from "@/lib/gallery-url";
import { useAsync } from "@/lib/hooks";
import { imageSrcSet, imageUrl, DETAIL_WIDTHS, orientedSize } from "@/lib/image";
import { CommentsSection } from "@/components/comments-section";
import { Lightbox } from "@/components/lightbox";
import { ReactionButtons } from "@/components/reaction-buttons";
import { ShareButton } from "@/components/share-button";
import { galleryShareSubject } from "@/lib/share-subject";
import { btnOutline, ErrorNote } from "@/components/ui";

/** The stage gets the viewport; the photo is the page. */
const STAGE_SIZES = "(min-width: 1024px) 80vw, 100vw";

/** Thumbnails either side of the current shot in the filmstrip. */
const STRIP_SIZE = 24;

/** Below this drag distance a touch is a tap, not a swipe. */
const SWIPE_THRESHOLD = 50;

export function GalleryItemView({
  slug,
  initial = null,
}: {
  slug: string;
  initial?: GalleryItemDetail | null;
}) {
  const router = useRouter();
  const [zoomed, setZoomed] = useState(false);
  const {
    data: item,
    loading,
    error,
  } = useAsync(
    () => galleryApi.getGalleryItem(slug),
    [slug],
    initial,
  );

  const prevPath = item?.prev ? galleryPath(item.prev) : null;
  const nextPath = item?.next ? galleryPath(item.next) : null;

  const goPrev = useCallback(() => {
    if (prevPath) router.push(prevPath);
  }, [prevPath, router]);

  const goNext = useCallback(() => {
    if (nextPath) router.push(nextPath);
  }, [nextPath, router]);

  // Arrow keys page the archive, Escape leaves it — the shortcuts any photo
  // viewer is expected to have. The lightbox owns Escape while it's open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (zoomed || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") router.push("/gallery");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed, goPrev, goNext, router]);

  // Warm the neighbours so paging feels instant.
  useEffect(() => {
    if (prevPath) router.prefetch(prevPath);
    if (nextPath) router.prefetch(nextPath);
  }, [prevPath, nextPath, router]);

  if (loading && !item) return <StageSkeleton />;

  if (error || !item) {
    return (
      <section className="flex w-full flex-col items-start gap-6 px-4 py-24 sm:px-6">
        <h1 className="text-4xl uppercase tracking-tight sm:text-5xl">
          Not found
        </h1>
        <ErrorNote
          message={error ?? "This shot doesn't exist or was removed."}
        />
        <Link href="/gallery" className={btnOutline}>
          Back to gallery
        </Link>
      </section>
    );
  }

  const counter = `${String(item.position).padStart(3, "0")} / ${String(
    item.total,
  ).padStart(3, "0")}`;

  return (
    <>
      {zoomed && (
        <Lightbox
          src={item.imageUrl}
          alt={item.altText ?? item.title}
          caption={item.title}
          rotation={item.rotation}
          onClose={() => setZoomed(false)}
        />
      )}

      {/* ---- Chrome: where you are, and the way out ---- */}
      <div className="sticky top-16 z-30 flex items-center justify-between gap-4 border-b border-subtle bg-background px-4 py-2.5 sm:px-6">
        <Link
          href="/gallery"
          className="rounded-[2px] text-[10px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
        >
          ← All shots
        </Link>
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted tabular-nums">
          {counter}
        </p>
      </div>

      <Stage
        item={item}
        onZoom={() => setZoomed(true)}
        onPrev={goPrev}
        onNext={goNext}
      />

      {/* ---- Meta: title, date, caption, reactions ---- */}
      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl uppercase leading-none tracking-tight sm:text-5xl">
              {item.title}
            </h1>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              {formatDate(item.createdAt)}
            </p>
            {item.description && (
              <p className="mt-4 max-w-md text-sm leading-7 text-muted">
                {item.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ReactionButtons
              targetType="gallery"
              targetId={item.id}
              likeCount={item.likeCount}
              dislikeCount={item.dislikeCount}
              myReaction={item.myReaction}
            />
            <ShareButton subject={galleryShareSubject(item)} />
          </div>
        </div>
      </section>

      <Filmstrip currentId={item.id} position={item.position} />

      <section className="mx-auto w-full max-w-5xl px-4 pb-24 pt-12 sm:px-6">
        <CommentsSection targetType="gallery" targetId={item.id} />
      </section>
    </>
  );
}

/**
 * The photograph, centred on a full-bleed field with paging controls at the
 * edges. Sized in `dvh` so the whole shot is visible without scrolling, on
 * phones included.
 */
function Stage({
  item,
  onZoom,
  onPrev,
  onNext,
}: {
  item: GalleryItemDetail;
  onZoom: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  return (
    <section
      aria-label={`Shot ${item.title}`}
      className="relative flex min-h-[62dvh] items-center justify-center overflow-hidden bg-surface px-14 py-6 sm:min-h-[70dvh] sm:px-20"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        // Ignore mostly-vertical drags so page scrolling still works.
        if (Math.abs(dx) < SWIPE_THRESHOLD) return;
        if (Math.abs(dx) < Math.abs(t.clientY - start.y)) return;
        if (dx > 0) onPrev();
        else onNext();
      }}
    >
      <button
        type="button"
        onClick={onZoom}
        aria-label={`Open ${item.title} full size`}
        className="group block cursor-zoom-in rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(item.imageUrl, 1400, "detail", item.rotation)}
          srcSet={imageSrcSet(item.imageUrl, DETAIL_WIDTHS, "detail", item.rotation) || undefined}
          sizes={STAGE_SIZES}
          alt={item.altText ?? item.title}
          width={orientedSize(item.width, item.height, item.rotation).width}
          height={orientedSize(item.width, item.height, item.rotation).height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="max-h-[58dvh] w-auto max-w-full rounded-[2px] object-contain transition-opacity duration-200 group-hover:opacity-95 sm:max-h-[66dvh]"
        />
      </button>

      <PageButton
        direction="prev"
        target={item.prev}
        onClick={onPrev}
      />
      <PageButton direction="next" target={item.next} onClick={onNext} />
    </section>
  );
}

function PageButton({
  direction,
  target,
  onClick,
}: {
  direction: "prev" | "next";
  target: { title: string } | null;
  onClick: () => void;
}) {
  const isPrev = direction === "prev";
  const label = isPrev ? "Previous shot" : "Next shot";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!target}
      aria-label={target ? `${label} — ${target.title}` : `${label} (none)`}
      className={`absolute inset-y-0 flex w-14 items-center justify-center text-2xl text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted enabled:hover:bg-background/40 enabled:hover:text-foreground disabled:cursor-default disabled:opacity-25 sm:w-20 ${
        isPrev ? "left-0" : "right-0"
      }`}
    >
      <span aria-hidden="true">{isPrev ? "‹" : "›"}</span>
    </button>
  );
}

/**
 * Nearby shots as a scrollable strip, so you can jump several ahead instead of
 * clicking next repeatedly. Loads the archive page the current shot sits in.
 */
function Filmstrip({
  currentId,
  position,
}: {
  currentId: string;
  position: number;
}) {
  const page = Math.max(1, Math.ceil(position / STRIP_SIZE));
  const { data } = useAsync(
    () => galleryApi.listGallery({ page, pageSize: STRIP_SIZE }),
    [page],
  );
  const current = useRef<HTMLAnchorElement>(null);

  // Bring the active thumbnail into view without yanking the page around it.
  useEffect(() => {
    current.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [currentId, data]);

  const items: GalleryItem[] = data?.items ?? [];
  if (items.length <= 1) return null;

  return (
    <nav
      aria-label="Nearby shots"
      className="w-full border-y border-subtle py-4"
    >
      <ul className="flex gap-2 overflow-x-auto px-4 sm:px-6">
        {items.map((shot) => {
          const isCurrent = shot.id === currentId;
          return (
            <li key={shot.id} className="shrink-0">
              <Link
                ref={isCurrent ? current : undefined}
                href={galleryPath(shot)}
                aria-current={isCurrent ? "true" : undefined}
                title={shot.title}
                className={`block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
                  isCurrent
                    ? "opacity-100 ring-2 ring-foreground"
                    : "opacity-50 transition-opacity hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(shot.imageUrl, 160, "tile", shot.rotation)}
                  alt={shot.altText ?? shot.title}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  className="size-14 bg-surface object-cover sm:size-16"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Reserves the stage so the photo doesn't shove the page down on arrival. */
function StageSkeleton() {
  return (
    <>
      <div className="sticky top-16 z-30 h-10 border-b border-subtle bg-background" />
      <div
        aria-busy="true"
        aria-label="Loading shot"
        className="min-h-[62dvh] w-full animate-pulse bg-surface sm:min-h-[70dvh]"
      />
    </>
  );
}
