"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The sheet model.
 *
 * A book is not a list of pages, it is a stack of leaves, and each leaf carries
 * two pages: a front (recto) and a back (verso). Turning leaf `i` rotates it
 * -180deg about the spine, which is its own left edge -- so the leaf lands
 * mirrored on the left half of the spread with its back face toward the reader.
 *
 * That is the whole trick, and it means there is no separate "left page"
 * element to keep in sync: the left page of any spread is simply the back of
 * the last leaf that was turned.
 */
export interface BookState {
  /** How many leaves have been turned. 0 = closed on the cover. */
  turned: number;
  /** Leaf currently under the pointer, or null. */
  draggingLeaf: number | null;
  /** 0..1 through its turn, signed by direction. */
  dragProgress: number;
  /** True while a pointer is down, so transitions can be suppressed. */
  isDragging: boolean;
}

export interface UseBookOptions {
  pageCount: number;
  /** 2 in a spread, 1 on a phone. Decides how many pages a turn advances. */
  pagesPerLeaf: 1 | 2;
}

/** Fraction of a leaf's width a drag must cross to commit the turn. */
const COMMIT_THRESHOLD = 0.32;
/** px/ms past which a flick commits regardless of distance. */
const FLICK_VELOCITY = 0.45;

export function useBook({ pageCount, pagesPerLeaf }: UseBookOptions) {
  const leafCount = Math.ceil(pageCount / pagesPerLeaf);

  /**
   * How far the book can actually be turned.
   *
   * In a spread, turning the last leaf is legal: it lands on the left half and
   * shows its back, which is the closing page. In single-page mode there is no
   * left half -- a fully turned leaf rotates out of the container entirely --
   * so turning the last one would leave the reader looking at nothing. The
   * last page is the end of the book there, not the page after it.
   */
  const maxTurned = pagesPerLeaf === 1 ? Math.max(0, leafCount - 1) : leafCount;

  const [turned, setTurned] = useState(0);
  const [dragProgress, setDragProgress] = useState(0);
  const [draggingLeaf, setDraggingLeaf] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    startX: number;
    lastX: number;
    lastT: number;
    velocity: number;
    /** +1 turning forward, -1 turning back. */
    dir: 1 | -1;
    leaf: number;
    width: number;
    pointerId: number;
  } | null>(null);

  // A mode change (rotate the phone, resize the window) changes how many pages
  // a leaf holds, so the leaf index has to be re-derived from the page the
  // reader was actually on rather than carried across.
  const pageRef = useRef(0);
  useEffect(() => {
    setTurned(Math.min(maxTurned, Math.floor(pageRef.current / pagesPerLeaf)));
  }, [pagesPerLeaf, maxTurned]);
  useEffect(() => {
    pageRef.current = turned * pagesPerLeaf;
  }, [turned, pagesPerLeaf]);

  const canForward = turned < maxTurned;
  const canBack = turned > 0;

  const next = useCallback(() => {
    setTurned((t) => Math.min(maxTurned, t + 1));
  }, [maxTurned]);

  const prev = useCallback(() => {
    setTurned((t) => Math.max(0, t - 1));
  }, []);

  const goTo = useCallback(
    (leaf: number) => setTurned(Math.max(0, Math.min(maxTurned, leaf))),
    [maxTurned],
  );

  // --- Pointer ------------------------------------------------------------

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Let real controls inside a page do their own thing.
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("[data-book-control]")) return;
      const el = surfaceRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      // In a spread the grab side picks the direction; in single-page mode
      // there is only one page on screen, so the drag direction does.
      const grabbedRightHalf =
        pagesPerLeaf === 1 ? true : e.clientX - rect.left > rect.width / 2;

      const dir: 1 | -1 = grabbedRightHalf ? 1 : -1;
      const leaf = dir === 1 ? turned : turned - 1;
      if (dir === 1 ? leaf >= maxTurned : leaf < 0) return;

      el.setPointerCapture(e.pointerId);
      gesture.current = {
        startX: e.clientX,
        lastX: e.clientX,
        lastT: e.timeStamp,
        velocity: 0,
        dir,
        leaf,
        width: rect.width / pagesPerLeaf,
        pointerId: e.pointerId,
      };
      setDraggingLeaf(leaf);
      setIsDragging(true);
      setDragProgress(0);
    },
    [turned, maxTurned, pagesPerLeaf],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;

    const dt = Math.max(1, e.timeStamp - g.lastT);
    g.velocity = (e.clientX - g.lastX) / dt;
    g.lastX = e.clientX;
    g.lastT = e.timeStamp;

    const dx = e.clientX - g.startX;
    // Forward is a leftward drag, so the sign flips.
    const raw = (g.dir === 1 ? -dx : dx) / g.width;
    setDragProgress(Math.max(0, Math.min(1, raw)));
  }, []);

  const endGesture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.pointerId) return;

      const flicked =
        g.dir === 1
          ? g.velocity < -FLICK_VELOCITY
          : g.velocity > FLICK_VELOCITY;

      const commit = dragProgress > COMMIT_THRESHOLD || flicked;

      if (commit) {
        setTurned(g.dir === 1 ? g.leaf + 1 : g.leaf);
      }

      gesture.current = null;
      setIsDragging(false);
      setDraggingLeaf(null);
      setDragProgress(0);
      surfaceRef.current?.releasePointerCapture?.(e.pointerId);
    },
    [dragProgress],
  );

  // --- Keyboard -----------------------------------------------------------

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          prev();
          break;
        case " ":
          e.preventDefault();
          if (e.shiftKey) prev();
          else next();
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(maxTurned);
          break;
      }
    },
    [next, prev, goTo, maxTurned],
  );

  /**
   * The angle a given leaf is at right now, in degrees. Turned leaves sit at
   * -180; the one under the pointer is somewhere in between.
   */
  const angleFor = useCallback(
    (leaf: number): number => {
      if (draggingLeaf === leaf) {
        const g = gesture.current;
        if (g?.dir === -1) return -180 + dragProgress * 180;
        return -dragProgress * 180;
      }
      return leaf < turned ? -180 : 0;
    },
    [draggingLeaf, dragProgress, turned],
  );

  /**
   * Stacking. Unturned leaves count down so the topmost is the next to turn;
   * turned leaves count up so the most recently turned lies on top of the pile
   * on the left. The leaf being dragged is above both piles.
   */
  const zFor = useCallback(
    (leaf: number): number => {
      if (draggingLeaf === leaf) return leafCount + 10;
      return leaf < turned ? leaf : leafCount - leaf;
    },
    [draggingLeaf, turned, leafCount],
  );

  return {
    leafCount,
    maxTurned,
    turned,
    isDragging,
    draggingLeaf,
    canForward,
    canBack,
    next,
    prev,
    goTo,
    angleFor,
    zFor,
    surfaceRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endGesture,
      onPointerCancel: endGesture,
      onKeyDown,
    },
  };
}
