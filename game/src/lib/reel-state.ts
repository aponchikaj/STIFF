"use client";

/**
 * Small pieces of state the reel shares across every slide.
 *
 * **Sound.** Browsers only autoplay a muted video, so every clip starts
 * muted. One tap on the speaker unmutes — and that choice carries to the
 * next clip and the one after, the way a reel app behaves, instead of
 * resetting per video. Kept in a module store, not React state, because
 * the slides are siblings and the choice belongs to none of them.
 *
 * **Layout.** The reel fills the whole screen under the app's own bars,
 * which float over it. `useChromeInsets` measures those bars (tagged
 * `data-chrome` in nav.tsx) so captions and buttons clear them on every
 * breakpoint without a hard-coded height.
 */

import { useEffect, useState, useSyncExternalStore } from "react";

/* ---------------------------------------------------------------- sound */

let muted = true;
const soundListeners = new Set<() => void>();

export function setReelMuted(next: boolean): void {
  muted = next;
  soundListeners.forEach((l) => l());
}

export function useReelMuted(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      soundListeners.add(onChange);
      return () => soundListeners.delete(onChange);
    },
    () => muted,
    () => true,
  );
}

/* ---------------------------------------------------------- breakpoints */

/** `md` and up: video framed in the middle, rail beside it, comments docked. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const q = window.matchMedia("(min-width: 905px)");
      q.addEventListener("change", onChange);
      return () => q.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 905px)").matches,
    () => false,
  );
}

/* ---------------------------------------------------------------- chrome */

export interface ChromeInsets {
  top: number;
  bottom: number;
}

/** The heights of the app bars the reel sits under, kept current. */
export function useChromeInsets(): ChromeInsets {
  const [insets, setInsets] = useState<ChromeInsets>({ top: 56, bottom: 0 });

  useEffect(() => {
    const top = document.querySelector<HTMLElement>('[data-chrome="top"]');
    const bottom = document.querySelector<HTMLElement>('[data-chrome="bottom"]');
    const measure = () =>
      setInsets({
        top: top?.offsetHeight ?? 0,
        // Hidden from `md`: offsetHeight is 0 then, which is right.
        bottom: bottom?.offsetHeight ?? 0,
      });
    measure();
    const observer = new ResizeObserver(measure);
    if (top) observer.observe(top);
    if (bottom) observer.observe(bottom);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return insets;
}
