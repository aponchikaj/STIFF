"use client";

import { useLayoutEffect, useState } from "react";
import { AsteriskMark } from "./asterisk-mark";
import { CrystalMark } from "./crystal-mark";

type Phase = "loading" | "reveal" | "nav" | "gone";

const MIN_SPIN_MS = 900; // never flash the loader for just a few frames
const REVEAL_MS = 950; // asterisk shifts left + STIFF slides out
const NAV_MS = 650; // navbar drop duration before the overlay leaves

// Module-scope: survives client-side navigation (no replay when clicking
// back to home) but resets on a hard load/refresh of the site.
let playedThisPageLoad = false;

export function IntroOverlay() {
  const [phase, setPhase] = useState<Phase>("loading");

  useLayoutEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || playedThisPageLoad) {
      setPhase("gone");
      return;
    }
    playedThisPageLoad = true;

    const root = document.documentElement;
    root.classList.add("intro-nav-wait");
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Ready = JS running + brand fonts loaded, but never under MIN_SPIN_MS.
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    const minSpin = new Promise((r) => timers.push(setTimeout(r, MIN_SPIN_MS)));

    let cancelled = false;
    Promise.all([fontsReady, minSpin]).then(() => {
      if (cancelled) return;
      // 1. Asterisk moves left, STIFF slides out of it
      setPhase("reveal");
      timers.push(
        setTimeout(() => {
          // 2. Only after the wordmark has landed: navbar drops from the top
          setPhase("nav");
          root.classList.add("intro-nav-drop");
          timers.push(
            setTimeout(() => {
              // 3. Overlay leaves; the real hero underneath is pixel-identical
              setPhase("gone");
            }, NAV_MS),
          );
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
      className={`intro-overlay fixed inset-0 z-40 flex flex-col bg-background transition-opacity duration-[650ms] ease-out ${
        phase === "nav" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Without JS the intro can never finish — hide it so content shows */}
      <noscript>
        <style>{`.intro-overlay{display:none}`}</style>
      </noscript>
      {/* Mirrors the page structure (4rem navbar + 87svh hero) so the
          overlay composition sits exactly where the real hero renders */}
      <div className="h-16 shrink-0" />
      <div className="flex h-[87svh] items-center justify-center px-6">
        <div
          className={`flex items-center gap-4 sm:gap-6 ${
            phase === "loading" ? "intro-hold" : "intro-shift-run"
          }`}
        >
          {/* The crystal holds the loading beat, then crossfades into the
              asterisk as the wordmark lands — the mark it becomes. */}
          <div className="relative size-16 [perspective:600px] sm:size-28">
            <span
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                phase === "loading"
                  ? "animate-crystal-turn opacity-100"
                  : "opacity-0"
              }`}
            >
              <CrystalMark className="h-full" />
            </span>
            <AsteriskMark
              className={`absolute inset-0 size-full transition-opacity duration-300 ${
                phase === "loading" ? "opacity-0" : "opacity-100"
              }`}
            />
          </div>
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
    </div>
  );
}
