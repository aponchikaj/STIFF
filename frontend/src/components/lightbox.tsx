"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { imageSrcSet, imageUrl, DETAIL_WIDTHS, asRotation } from "@/lib/image";

/**
 * Full-screen image viewer with pan and zoom.
 *
 * Closes on the × button, Escape, or a click on the backdrop — but only while
 * the image is at rest. Once zoomed in, a click is how you pan, and closing on
 * pointer-up would make the thing impossible to use.
 *
 * The zoom matters more here than it looks: the whole pitch of these clothes
 * is the fabric, and an image scaled to fit a phone shows none of it. The
 * viewer already loads the widest render it can use, so zooming is reading
 * pixels that were fetched anyway rather than asking for new ones.
 */

/** Even at full screen, a capped render — 1920 covers any display worth serving. */
const MAX_WIDTH = 1920;

/** One tap in. Enough to read a weave, short of a pixel grid. */
const ZOOMED = 2.5;
const MAX_SCALE = 5;

/** Past this, a pointer-up is a drag, not a click. */
const DRAG_SLOP_PX = 6;

interface Point {
  x: number;
  y: number;
}

const ORIGIN: Point = { x: 0, y: 0 };

export function Lightbox({
  src,
  alt = "",
  caption,
  rotation = 0,
  onClose,
}: {
  src: string;
  alt?: string;
  caption?: string;
  rotation?: number | null;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>(ORIGIN);
  // State rather than a ref, because the transition depends on it: a ref read
  // during render is not guaranteed to reflect the gesture that is happening.
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Live pointer bookkeeping. Refs rather than state: these change on every
  // pointermove and none of them should cost a render.
  const pointers = useRef(new Map<number, Point>());
  const dragStart = useRef<Point | null>(null);
  const offsetStart = useRef<Point>(ORIGIN);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const moved = useRef(false);

  const zoomed = scale > 1;

  const reset = useCallback(() => {
    setScale(1);
    setOffset(ORIGIN);
  }, []);

  /**
   * Keeps the image's edges inside the frame.
   *
   * Without this, a hard drag flings the photograph off screen and leaves an
   * empty backdrop that still says it is showing something.
   */
  const clamp = useCallback((next: Point, atScale: number): Point => {
    const frame = frameRef.current;
    const image = imageRef.current;
    if (!frame || !image) return next;
    // The rendered box at scale 1, which is what the offset is relative to.
    const width = image.clientWidth;
    const height = image.clientHeight;
    const slackX = Math.max(0, (width * atScale - frame.clientWidth) / 2);
    const slackY = Math.max(0, (height * atScale - frame.clientHeight) / 2);
    return {
      x: Math.min(slackX, Math.max(-slackX, next.x)),
      y: Math.min(slackY, Math.max(-slackY, next.y)),
    };
  }, []);

  const zoomTo = useCallback(
    (nextScale: number, focus?: Point) => {
      const clamped = Math.min(MAX_SCALE, Math.max(1, nextScale));
      if (clamped === 1) {
        reset();
        return;
      }
      setScale((current) => {
        setOffset((currentOffset) => {
          const frame = frameRef.current;
          if (!frame || !focus) {
            return clamp(currentOffset, clamped);
          }
          // Keep whatever is under the pointer under the pointer: shift the
          // offset by how much that point moves as the scale changes.
          const box = frame.getBoundingClientRect();
          const fromCentreX = focus.x - (box.left + box.width / 2);
          const fromCentreY = focus.y - (box.top + box.height / 2);
          const ratio = clamped / current;
          return clamp(
            {
              x: currentOffset.x - fromCentreX * (ratio - 1),
              y: currentOffset.y - fromCentreY * (ratio - 1),
            },
            clamped,
          );
        });
        return clamped;
      });
    },
    [clamp, reset],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Escape steps out of the zoom first, then out of the viewer — the
        // same two-stage exit a map has.
        if (scale > 1) reset();
        else onClose();
      }
      if (e.key === "+" || e.key === "=") zoomTo(scale + 0.5);
      if (e.key === "-") zoomTo(scale - 0.5);
      if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, reset, scale, zoomTo]);

  // A new image in the same viewer starts at rest rather than inheriting the
  // last one's pan, which would land on empty space.
  useEffect(() => {
    reset();
  }, [src, reset]);

  function distanceBetween(points: Point[]): number {
    const [a, b] = points;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: distanceBetween([a, b]), scale };
      dragStart.current = null;
      setDragging(false);
      return;
    }
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = offset;
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const ratio = distanceBetween([a, b]) / pinchStart.current.distance;
      moved.current = true;
      zoomTo(pinchStart.current.scale * ratio, {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });
      return;
    }

    if (!dragStart.current || !zoomed) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.hypot(dx, dy) > DRAG_SLOP_PX) moved.current = true;
    setOffset(
      clamp(
        { x: offsetStart.current.x + dx, y: offsetStart.current.y + dy },
        scale,
      ),
    );
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    dragStart.current = null;
    setDragging(false);
  }

  /**
   * One click toggles the zoom, centred where you clicked.
   *
   * Guarded on `moved`, so releasing a pan does not also toggle — and closing
   * on the backdrop only counts while at rest, or every pan that ends over
   * empty space would shut the viewer.
   */
  function onClick(e: React.MouseEvent) {
    if (moved.current) {
      moved.current = false;
      return;
    }
    const onImage = imageRef.current?.contains(e.target as Node);
    if (!onImage) {
      if (zoomed) reset();
      else onClose();
      return;
    }
    zoomTo(zoomed ? 1 : ZOOMED, { x: e.clientX, y: e.clientY });
  }

  function onWheel(e: React.WheelEvent) {
    // Trackpad pinch arrives as a ctrl-wheel; a plain wheel over a full-screen
    // image has nothing else to do, so both zoom.
    zoomTo(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), {
      x: e.clientX,
      y: e.clientY,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption ? `${caption} — full size` : "Full-size image"}
      ref={frameRef}
      onClick={onClick}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`fixed inset-0 z-[90] flex select-none items-center justify-center overflow-hidden bg-foreground/90 p-4 ${
        zoomed ? "cursor-grab touch-none" : "cursor-zoom-out"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={imageUrl(src, MAX_WIDTH, "detail", asRotation(rotation))}
        srcSet={
          imageSrcSet(src, DETAIL_WIDTHS, "detail", asRotation(rotation)) ||
          undefined
        }
        // Constant on purpose. Re-pointing `sizes` when the zoom changes makes
        // the browser re-run srcset selection and decode another candidate
        // mid-gesture, which flashes the image out; on a full-screen dialog
        // `100vw` already selects the top candidate, so there was nothing to
        // win by switching.
        sizes="100vw"
        alt={alt}
        draggable={false}
        decoding="async"
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          // Only animate the snap back and the tap-to-zoom. Animating a drag
          // makes the image lag the finger.
          transition: dragging ? "none" : "transform 180ms ease-out",
        }}
        className={`max-h-[92dvh] max-w-full rounded-[2px] object-contain will-change-transform motion-reduce:transition-none ${
          zoomed ? "cursor-grab" : "cursor-zoom-in"
        }`}
      />

      {caption && !zoomed && (
        <p className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.25em] text-background">
          {caption}
        </p>
      )}

      <div className="absolute right-4 top-4 flex gap-2">
        <button
          type="button"
          aria-label={zoomed ? "Zoom out" : "Zoom in"}
          onClick={(e) => {
            e.stopPropagation();
            zoomTo(zoomed ? 1 : ZOOMED);
          }}
          className="flex size-11 items-center justify-center rounded-[2px] bg-background text-lg leading-none text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
        >
          {zoomed ? "−" : "+"}
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex size-11 items-center justify-center rounded-[2px] bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
        >
          ×
        </button>
      </div>

      {zoomed && (
        <p className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.25em] text-background">
          {Math.round(scale * 100)}% — drag to pan
        </p>
      )}
    </div>
  );
}
