"use client";

import { AsteriskMark } from "./asterisk-mark";

export function BackToTop() {
  function scrollToTop() {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      className="spin-on-hover flex size-11 items-center justify-center rounded-[2px] text-foreground transition-colors hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
    >
      <AsteriskMark className="size-6" />
    </button>
  );
}
