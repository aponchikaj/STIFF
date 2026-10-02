"use client";

import { usePrefersReducedMotion } from "@/lib/hooks";

/**
 * The tube, over the whole page.
 *
 * Four layers, each doing one job, all `pointer-events-none` and fixed so
 * they never move with the content:
 *
 *   scanlines — the 2px banding the icon set has baked into its own art.
 *               Running it over everything is what makes the icons sit *in*
 *               the screen instead of on top of it.
 *   vignette  — corner falloff. A real tube is dimmer at the edges, and
 *               without this the page reads as flat black paper.
 *   aperture  — a faint RGB stripe at 3px. Only visible as texture, but it
 *               is the difference between "dark theme" and "CRT".
 *   roll      — the slow bright band drifting down. The only moving part,
 *               and the one thing that makes a still screen feel powered.
 *
 * The roll is dropped under `prefers-reduced-motion`; the static layers
 * stay, because they are texture, not motion.
 */
export function CrtOverlay() {
  const reduced = usePrefersReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]">
      {/* scanlines */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(to bottom, rgb(0 0 0 / 0) 0px, rgb(0 0 0 / 0) 1.5px, rgb(0 0 0 / 0.2) 2.5px, rgb(0 0 0 / 0.2) 3.5px)",
        }}
      />

      {/* aperture grille */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-screen"
        style={{
          background:
            "repeating-linear-gradient(to right, rgb(255 0 60) 0px, rgb(255 0 60) 1px, rgb(0 255 120) 1px, rgb(0 255 120) 2px, rgb(60 120 255) 2px, rgb(60 120 255) 3px)",
        }}
      />

      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 100% at 50% 50%, transparent 40%, rgb(0 0 0 / 0.55) 100%)",
        }}
      />

      {/* roll */}
      {reduced ? null : (
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-x-0 h-[22%] animate-[scanline-roll_9s_linear_infinite]"
            style={{
              background:
                "linear-gradient(to bottom, rgb(1 231 255 / 0) 0%, rgb(1 231 255 / 0.045) 50%, rgb(1 231 255 / 0) 100%)",
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The cyan haze that sits behind a hero.
 *
 * On a pure-black page a big glowing wordmark has nothing to glow *onto*,
 * so the bloom stops dead at the letterforms. This puts a soft field of
 * light behind it for the glow to land in. Purely atmospheric — place it
 * behind content, never over it.
 */
export function Haze({
  className,
  intensity = "md",
}: {
  className?: string;
  intensity?: "sm" | "md" | "lg";
}) {
  const alpha = { sm: 0.07, md: 0.13, lg: 0.22 }[intensity];

  return (
    <div
      aria-hidden
      className={className ?? "pointer-events-none absolute inset-0 -z-10"}
      style={{
        background: `radial-gradient(ellipse 70% 55% at 50% 45%, rgb(1 163 255 / ${alpha}) 0%, transparent 70%)`,
      }}
    />
  );
}
