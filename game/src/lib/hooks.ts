"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { secondsUntil } from "./utils";

/**
 * A countdown that ticks locally.
 *
 * The server is the authority on when a clock expires — `AssignmentView`
 * carries both `expiresAt` and a server-computed `secondsLeft` — but asking
 * it every second is 1,800 requests over a thirty-minute task. So the
 * deadline is fetched once and the digits are counted down here.
 *
 * Two deliberate choices:
 *
 * **Derived, not decremented.** The value is recomputed from `expiresAt` on
 * every render rather than stepped down by one. A tab that sleeps stops
 * firing intervals, and a decremented counter would wake up minutes behind,
 * showing a player time they do not have. Recomputing is correct the
 * instant the tab wakes; the interval only exists to force the re-render.
 *
 * **250ms, not 1000ms.** A one-second interval drifts against the wall
 * clock and the display visibly skips a number. Four cheap recomputations a
 * second never skip.
 */
export function useCountdown(
  expiresAt: string | null | undefined,
  onExpire?: () => void,
): number {
  const [, forceTick] = useState(0);
  const seconds = secondsUntil(expiresAt);

  useEffect(() => {
    if (!expiresAt) return;

    const bump = () => forceTick((n) => n + 1);
    const id = window.setInterval(bump, 250);
    // A backgrounded tab throttles timers hard. Recompute the moment it is
    // looked at again, rather than waiting up to a minute for the next tick.
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [expiresAt]);

  // Fires once, on the transition to zero — not on every render where the
  // value is already zero.
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  // Kept current in an effect, not during render: a ref written while
  // rendering is torn under concurrent React, which can re-render a
  // component and throw the result away.
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    firedRef.current = false;
  }, [expiresAt]);

  useEffect(() => {
    if (!expiresAt || seconds > 0 || firedRef.current) return;
    firedRef.current = true;
    onExpireRef.current?.();
  }, [expiresAt, seconds]);

  return seconds;
}

/* -------------------------------------------------------- external state */

const noopSubscribe = () => () => {};

/**
 * True once mounted, false on the server and during hydration.
 *
 * `useSyncExternalStore` with a constant pair rather than a state flag set
 * in an effect: this is exactly the "is the client live yet" question the
 * hook exists to answer, and React resolves it without a second render.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * `prefers-reduced-motion`, live.
 *
 * The CSS layer in `globals.css` already neutralises declarative animation.
 * This is for the JS-driven kind — GSAP timelines, Lenis, confetti, a
 * framer-motion variant — which CSS cannot reach.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    // Assume no preference on the server. Assuming *reduced* would ship a
    // motionless first paint to everyone and then animate in, which is the
    // worse of the two wrong guesses.
    () => false,
  );
}

/** Debounced mirror of a value. For a search box, so a keystroke is not a
 *  request — the player search route throttles at 40/min server-side. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

/* ---------------------------------------------------------------- media */

/**
 * Reads a file's real dimensions and duration.
 *
 * The hand-in flow must send these *before* it uploads. A client that
 * guesses is rejected twice — once asking for the upload URL and again on
 * confirm, since the backend re-checks the same claims against the same
 * rules. Measuring is the only honest option.
 *
 * Resolves to an empty object on a file the browser cannot decode; the
 * caller then lets the server be the one to refuse it, with its own wording.
 */
export async function measureMedia(file: File): Promise<{
  width?: number;
  height?: number;
  durationSeconds?: number;
}> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("video/")) {
      return await new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () =>
          resolve({
            width: video.videoWidth,
            height: video.videoHeight,
            // Whole seconds: the DTO validates an integer.
            durationSeconds: Math.round(video.duration),
          });
        video.onerror = () => resolve({});
        video.src = url;
      });
    }

    return await new Promise((resolve) => {
      const image = new window.Image();
      image.onload = () =>
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({});
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
