"use client";

import { useLayoutEffect, useState } from "react";
import { AsteriskMark } from "./asterisk-mark";

type Phase = "loading" | "reveal" | "fade" | "gone";

const MIN_SPIN_MS = 900; // never flash the loader for just a few frames
const REVEAL_MS = 1200;
const FADE_MS = 500;

export function IntroOverlay() {
  const [phase, setPhase] = useState<Phase>("loading");

  useLayoutEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = sessionStorage.getItem("stiff-intro") === "1";
    if (reduce || seen) {
      setPhase("gone");
      return;
    }

    const root = document.documentElement;
    root.classList.add("intro-nav-wait");
    const timers: ReturnType<typeof setTimeout>[] = [];

    // "Server responded" = the page is actually ready: JS is running and
    // the brand fonts are loaded, but never shorter than MIN_SPIN_MS.
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    const minSpin = new Promise((r) => timers.push(setTimeout(r, MIN_SPIN_MS)));

    let cancelled = false;
    Promise.all([fontsReady, minSpin]).then(() => {
      if (cancelled) return;
      setPhase("reveal");
      timers.push(
        setTimeout(() => {
          setPhase("fade");
          root.classList.add("intro-nav-drop");
          sessionStorage.setItem("stiff-intro", "1");
          timers.push(setTimeout(() => setPhase("gone"), FADE_MS));
        }, REVEAL_MS),
      );
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      root.classList.remove("intro-nav-wait", "intro-nav-drop");
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      className={`intro-overlay fixed inset-0 z-[60] flex items-center justify-center bg-background transition-opacity duration-500 ${
        phase === "fade" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* Without JS the intro can never finish — hide it so content shows */}
      <noscript>
        <style>{`.intro-overlay{display:none}`}</style>
      </noscript>
      <div
        className={`flex items-center gap-4 sm:gap-6 ${
          phase === "loading" ? "intro-hold" : "intro-shift-run"
        }`}
      >
        {/* 6-fold symmetry hides the rotation snap when the spin stops */}
        <AsteriskMark
          className={`size-16 sm:size-28 ${
            phase === "loading" ? "animate-spin-slow" : ""
          }`}
        />
        <div className="overflow-hidden">
          <span
            className={`font-display block text-7xl uppercase leading-none tracking-tight sm:text-9xl ${
              phase === "loading" ? "opacity-0" : "intro-slide-run"
            }`}
          >
            Stiff
          </span>
        </div>
      </div>
    </div>
  );
}
