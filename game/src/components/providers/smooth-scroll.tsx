"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Lenis smooth scrolling, wired to the real rAF loop.
 *
 * Disabled outright under `prefers-reduced-motion`: hijacking the scroll is
 * exactly the kind of motion that setting is asking us not to do, and Lenis
 * has no "reduced" mode — it is on or it is native.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const lenis = new Lenis({
      duration: 0.9,
      // Matches --ease-arcade: fast start, long settle, no overshoot.
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Touch is left native. Smoothing it on a phone fights the OS and
      // makes a feed feel laggy rather than smooth.
      syncTouch: false,
    });

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
