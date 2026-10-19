"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/hooks";

/**
 * The STIFF wordmark.
 *
 * The reference is not a word in a font — it is a photograph of a word on a
 * tube, and the difference is four things stacked in z-order. Rendering
 * just glowing text gets maybe a third of the way there.
 *
 *   1. **Bleed.** Two copies behind the mark, offset a pixel left and right
 *      and tinted red/cyan, blurred. This is beam misconvergence and it is
 *      what stops the letterforms looking vector-crisp.
 *   2. **Core.** The pale #A8F8FF mark itself, with a staged bloom — a
 *      white-hot ring, then wide #43DFFF — so the light falls off the way a
 *      phosphor does rather than as one flat halo.
 *   3. **Bands.** Horizontal scanlines cut *through* the glyphs via a
 *      masked overlay, not laid over the whole box. The reference's most
 *      distinctive feature is that the lines are inside the letters.
 *   4. **Flicker.** A barely-there opacity jitter on a long loop. Off under
 *      reduced motion; the first three layers carry it alone.
 *
 * Sized by the `size` prop in `vw` so it fills the viewport width at any
 * breakpoint without a media query per step — a pixel face wants to be as
 * large as the screen allows and nothing else on this page competes.
 */
/**
 * Average advance of one capital in the display face, in em — Silkscreen
 * Bold's ~0.85 at the 120% size-adjust. Re-measure when the CC Pixel Arcade
 * files land.
 */
const GLYPH_ADVANCE = 0.98;

export function Wordmark({
  children = "STIFF",
  className,
  vw = 0.78,
  maxPx = 190,
}: {
  children?: string;
  className?: string;
  /** Share of the viewport width the whole mark should span, 0–1. */
  vw?: number;
  maxPx?: number;
}) {
  const reduced = usePrefersReducedMotion();

  // Divide the target span by the character count rather than hardcoding a
  // vw. Silkscreen (the stand-in until CC Pixel Arcade is licensed) and the
  // real face have different advance widths, so a figure tuned for one
  // overflows with the other. This holds either way.
  const perChar = vw / Math.max(1, children.length) / GLYPH_ADVANCE;
  const fontSize = `min(${(perChar * 100).toFixed(2)}vw, ${maxPx}px)`;

  const base: React.CSSProperties = {
    fontSize,
    lineHeight: 0.88,
    letterSpacing: "0.02em",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={cn("relative select-none", className)}
    >
      <div
        className={cn(
          "relative font-display uppercase pixel-snap",
          reduced ? "" : "animate-[flicker_7s_linear_infinite]",
        )}
        style={base}
      >
        {/* 1 — chromatic bleed */}
        <span
          aria-hidden
          className="absolute inset-0 text-[rgb(255,0,60)] opacity-25 blur-[2px]"
          style={{ ...base, transform: "translateX(-2px)" }}
        >
          {children}
        </span>
        <span
          aria-hidden
          className="absolute inset-0 text-blue opacity-60 blur-[2px]"
          style={{ ...base, transform: "translateX(2px)" }}
        >
          {children}
        </span>

        {/* 2 — the core */}
        <span
          className="relative block text-cyan"
          style={{
            ...base,
            textShadow:
              "0 0 5px rgb(228 253 255 / 0.95), 0 0 18px rgb(67 223 255 / 0.9), 0 0 52px rgb(67 223 255 / 0.6), 0 0 120px rgb(67 223 255 / 0.35)",
          }}
        >
          {children}
        </span>

        {/* 3 — bands cut through the glyphs, not over the box */}
        <span
          aria-hidden
          className="absolute inset-0 block text-bone"
          style={{
            ...base,
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgb(0 0 0 / 0.5) 0px, rgb(0 0 0 / 0.5) 1.5px, transparent 1.5px, transparent 5px)",
            // Paint the band pattern only where the letterforms are.
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {children}
        </span>
      </div>
    </motion.div>
  );
}
