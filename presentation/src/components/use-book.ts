"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * The sheet model.
 *
 * A book is a stack of leaves, and each leaf carries two pages: a front
 * (recto) and a back (verso). Turning leaf `i` rotates it -180° about the
 * spine, which is its own left edge, so it lands mirrored on the left half of
 * the spread with its back face toward the reader. The left page of any
 * spread is simply the back of the last leaf that was turned.
 *
 * The hook is controlled: `turned` comes in (derived from the URL by the
 * caller) and every turn goes out through `onTurned`. What the hook owns is
 * the physical part — the drag, the flick, which leaf is in the air and must
 * be stacked above both piles, and the imperative angle writes during a drag
 * so a pointer move never re-renders twenty-four pages.
 */

export interface UseBookOptions {
  leafCount: number;
  maxTurned: number;
  turned: number;
  /** 2 in a spread, 1 on a phone. */
  pagesPerLeaf: 1 | 2;
  /** Full-turn duration, must match `--turn-ms` in CSS. */
  turnMs: number;
  onTurned: (turned: number) => void;
  /** A press that never became a drag. */
  onTap?: (e: React.PointerEvent<HTMLDivElement>) => void;
  /**
   * False until the browser has taken over from the server-rendered page.
   * The first live render lands on whatever page the URL names, and that
   * jump must snap — a deep link into page thirteen is not twelve turns.
   */
  live: boolean;
}

/** Fraction of a page's width a drag must cross to commit the turn. */
const COMMIT = 0.3;
/** px/ms past which a flick commits regardless of distance. */
const FLICK = 0.4;
/** px of travel before a press is a drag. */
const SLOP = 7;
/** ms between leaves when several turn at once (Home / End). */
const STAGGER = 55;

interface Gesture {
  id: number;
  x0: number;
  y0: number;
  lastX: number;
  lastT: number;
  v: number;
  /** Width of one page in px. */
  width: number;
  /** Side grabbed in a spread: +1 recto, -1 verso, 0 when there is one page. */
  half: 1 | -1 | 0;
  leaf: number;
  dir: 1 | -1;
  active: boolean;
  moved: boolean;
  p: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function useBook({
  leafCount,
  maxTurned,
  turned,
  pagesPerLeaf,
  turnMs,
  onTurned,
  onTap,
  live,
}: UseBookOptions) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const leafEls = useRef<(HTMLDivElement | null)[]>([]);
  const gesture = useRef<Gesture | null>(null);

  /** leaf → sequence number. Earlier-lifted leaves stack above later ones. */
  const [lifted, setLifted] = useState<ReadonlyMap<number, number>>(
    () => new Map(),
  );
  const seq = useRef(0);
  const timers = useRef(new Map<number, number>());
  const [dragging, setDragging] = useState(false);
  const [frozen, setFrozen] = useState(false);

  const setLeafRef = useCallback(
    (i: number) => (el: HTMLDivElement | null) => {
      leafEls.current[i] = el;
    },
    [],
  );

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  /** Put a leaf above both piles for `ms`, then drop it and clean its inline timing. */
  const lift = useCallback((leaf: number, ms: number) => {
    setLifted((m) => {
      if (m.has(leaf)) return m;
      const n = new Map(m);
      n.set(leaf, ++seq.current);
      return n;
    });
    const old = timers.current.get(leaf);
    if (old) window.clearTimeout(old);
    timers.current.set(
      leaf,
      window.setTimeout(() => {
        timers.current.delete(leaf);
        const el = leafEls.current[leaf];
        if (el) {
          el.style.transitionDuration = "";
          el.style.transitionDelay = "";
        }
        setLifted((m) => {
          if (!m.has(leaf)) return m;
          const n = new Map(m);
          n.delete(leaf);
          return n;
        });
      }, ms + 60),
    );
  }, []);

  // Whatever changed `turned` — a key, a tap, the back button — the leaves
  // between the old and new value are now in the air and must be stacked
  // above both piles for the length of their turn. Layout effect, so the
  // z-order is right on the first painted frame of the transition.
  const prev = useRef({ turned, pagesPerLeaf, live });
  useLayoutEffect(() => {
    const p = prev.current;
    prev.current = { turned, pagesPerLeaf, live };

    if (p.pagesPerLeaf !== pagesPerLeaf || p.live !== live) {
      // The leaves mean something else now, or the page is only just
      // alive. Snap, don't animate.
      setLifted(new Map());
      setFrozen(true);
      const id = requestAnimationFrame(() => setFrozen(false));
      return () => cancelAnimationFrame(id);
    }
    if (p.turned === turned) return;

    const lo = Math.min(p.turned, turned);
    const hi = Math.max(p.turned, turned);
    const n = hi - lo;
    for (let leaf = lo; leaf < hi; leaf++) {
      const k = turned > p.turned ? leaf - lo : hi - 1 - leaf;
      const delay = n > 1 ? k * STAGGER : 0;
      const el = leafEls.current[leaf];
      if (el && n > 1) el.style.transitionDelay = `${delay}ms`;
      lift(leaf, turnMs + delay);
    }
  }, [turned, pagesPerLeaf, live, lift, turnMs]);

  // --- Commands -------------------------------------------------------------

  const goTo = useCallback(
    (t: number) => onTurned(Math.max(0, Math.min(maxTurned, t))),
    [onTurned, maxTurned],
  );
  const next = useCallback(() => goTo(turned + 1), [goTo, turned]);
  const prevLeaf = useCallback(() => goTo(turned - 1), [goTo, turned]);

  // --- The drag -------------------------------------------------------------

  const paint = (leaf: number, angle: number) => {
    const el = leafEls.current[leaf];
    if (!el) return;
    el.style.transform = `rotateY(${angle}deg)`;
    el.style.setProperty("--p", String(-angle / 180));
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("[data-book-control], a, button")) return;
      const el = surfaceRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const half: 1 | -1 | 0 =
        pagesPerLeaf === 2
          ? e.clientX - rect.left > rect.width / 2
            ? 1
            : -1
          : 0;

      gesture.current = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        lastX: e.clientX,
        lastT: e.timeStamp,
        v: 0,
        width: rect.width / pagesPerLeaf,
        half,
        leaf: -1,
        dir: 1,
        active: false,
        moved: false,
        p: 0,
      };
    },
    [pagesPerLeaf],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.id) return;

      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;

      if (!g.active) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        g.moved = true;
        // Mostly vertical: that is a scroll of the page's text, not a turn.
        if (Math.abs(dy) > Math.abs(dx)) {
          gesture.current = null;
          return;
        }
        // In a spread the page grabbed decides the direction; with one page on
        // screen the direction of the drag does.
        const dir: 1 | -1 = g.half !== 0 ? g.half : dx < 0 ? 1 : -1;
        if (dir === 1 ? turned >= maxTurned : turned <= 0) {
          gesture.current = null;
          return;
        }
        g.dir = dir;
        g.leaf = dir === 1 ? turned : turned - 1;
        g.active = true;
        surfaceRef.current?.setPointerCapture(e.pointerId);
        const el = leafEls.current[g.leaf];
        if (el) el.style.transition = "none";
        lift(g.leaf, 60_000);
        setDragging(true);
      }

      const dt = Math.max(1, e.timeStamp - g.lastT);
      g.v = (e.clientX - g.lastX) / dt;
      g.lastX = e.clientX;
      g.lastT = e.timeStamp;

      // Forward is a leftward drag, so the sign flips.
      g.p = clamp01((g.dir === 1 ? -dx : dx) / g.width);
      paint(g.leaf, g.dir === 1 ? -g.p * 180 : -180 + g.p * 180);
    },
    [turned, maxTurned, lift],
  );

  const endGesture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.id) return;
      gesture.current = null;

      if (!g.active) {
        if (!g.moved && !cancelled) onTap?.(e);
        return;
      }

      surfaceRef.current?.releasePointerCapture?.(e.pointerId);
      setDragging(false);

      const flicked = g.dir === 1 ? g.v < -FLICK : g.v > FLICK;
      const commit = !cancelled && (g.p > COMMIT || flicked);
      const remaining = commit ? 1 - g.p : g.p;
      const ms = Math.max(160, Math.round(turnMs * Math.max(0.3, remaining)));

      const el = leafEls.current[g.leaf];
      if (el) {
        // Back to the stylesheet's transition, shortened to the distance left.
        el.style.transition = "";
        el.style.transitionDuration = `${ms}ms`;
      }
      const finalTurned = commit ? (g.dir === 1 ? g.leaf + 1 : g.leaf) : turned;
      paint(g.leaf, g.leaf < finalTurned ? -180 : 0);
      lift(g.leaf, ms);
      if (commit) onTurned(finalTurned);
    },
    [turned, turnMs, lift, onTurned, onTap],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => endGesture(e, false),
    [endGesture],
  );
  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => endGesture(e, true),
    [endGesture],
  );

  /**
   * Stacking. Unturned leaves count down so the topmost is the next to turn;
   * turned leaves count up so the most recently turned lies on top of the
   * left pile. A leaf in the air is above both, and of several in the air the
   * one that took off first is highest — it is the one on top of the pile.
   */
  const zFor = useCallback(
    (leaf: number): number => {
      const s = lifted.get(leaf);
      if (s !== undefined) {
        let latest = s;
        lifted.forEach((v) => {
          if (v > latest) latest = v;
        });
        return leafCount + 10 + (latest - s);
      }
      return leaf < turned ? leaf + 1 : leafCount - leaf;
    },
    [lifted, turned, leafCount],
  );

  return {
    surfaceRef,
    setLeafRef,
    dragging,
    frozen,
    lifted,
    zFor,
    next,
    prev: prevLeaf,
    goTo,
    canForward: turned < maxTurned,
    canBack: turned > 0,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
