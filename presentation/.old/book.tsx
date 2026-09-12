"use client";

import { useEffect, useState } from "react";
import { PAGES, folioFor } from "@/content/journal";
import { PageFace } from "./page-face";
import { useBook } from "./use-book";

/** Below this the spread stops being readable and the book goes single-page. */
const SPREAD_MIN_WIDTH = 900;

function useSpread(): boolean {
  // Start single-page: it is the safe render for SSR, and only widens once the
  // real viewport is known, so a phone never paints a spread first.
  const [spread, setSpread] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(
      `(min-width: ${SPREAD_MIN_WIDTH}px) and (min-height: 520px)`,
    );
    const sync = () => setSpread(mq.matches);
    sync();
    // `change` alone is not enough: it can be missed on an orientation flip and
    // under devtools viewport emulation, which strands the book in the wrong
    // mode -- a spread laid out in a phone's width, at 6px type. `resize` is
    // the belt to that braces, and re-reads the same query.
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);
  return spread;
}

export function Book() {
  const spread = useSpread();
  const pagesPerLeaf = spread ? 2 : 1;

  const {
    leafCount,
    maxTurned,
    turned,
    isDragging,
    canForward,
    canBack,
    next,
    prev,
    goTo,
    angleFor,
    zFor,
    surfaceRef,
    handlers,
  } = useBook({ pageCount: PAGES.length, pagesPerLeaf });

  // Arrow keys work without the reader having to click the book first. The
  // element keeps its own handler too, so focus-visible and screen-reader
  // behaviour stay correct for keyboard users who do tab to it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A keydown can be targeted at document or window, which have no
      // `closest`; only narrow when there is a real element to narrow on.
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      if (t?.closest("[data-book-control]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === " ") {
        e.preventDefault();
        if (e.shiftKey) prev();
        else next();
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(maxTurned);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo, maxTurned]);

  const leaves = Array.from({ length: leafCount }, (_, i) => i);
  const closed = turned === 0;
  const finished = turned === maxTurned;

  // Closed, the cover must sit in the middle of the screen rather than in the
  // right half of an invisible spread -- so the whole book slides half a page
  // across, and slides back as it opens. Same at the far end, mirrored.
  const shift = spread ? (closed ? "-25%" : finished ? "25%" : "0%") : "0%";

  const currentPage = Math.min(PAGES.length, turned * pagesPerLeaf + 1);

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-[2vh] overflow-hidden px-[3vw] py-[3vh]">
      <div
        className={`book-stage ${spread ? "is-spread" : "is-single"}`}
        style={{ transform: `translateX(${shift})` }}
      >
        <div
          ref={surfaceRef}
          role="application"
          aria-roledescription="journal"
          aria-label="Opal journal. Use the arrow keys, or drag a page, to turn."
          tabIndex={0}
          className="book-surface"
          {...handlers}
        >
          {leaves.map((i) => {
            const frontIndex = i * pagesPerLeaf;
            const backIndex = spread ? frontIndex + 1 : -1;
            const angle = angleFor(i);
            const flipped = angle < -90;

            return (
              <div
                key={i}
                className="leaf"
                style={{
                  zIndex: zFor(i),
                  transform: `rotateY(${angle}deg)`,
                  transition: isDragging
                    ? "none"
                    : "transform var(--turn-duration) var(--turn-ease)",
                }}
              >
                <div className="leaf-face leaf-front" aria-hidden={flipped}>
                  <div className="page-sheet">
                    <PageFace
                      page={PAGES[frontIndex]}
                      folio={folioFor(frontIndex)}
                      side="recto"
                    />
                    <span className="gutter gutter-recto" aria-hidden />
                  </div>
                </div>

                <div className="leaf-face leaf-back" aria-hidden={!flipped}>
                  <div className="page-sheet">
                    <PageFace
                      page={spread ? PAGES[backIndex] : undefined}
                      folio={spread ? folioFor(backIndex) : null}
                      side="verso"
                    />
                    <span className="gutter gutter-verso" aria-hidden />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <nav className="flex shrink-0 items-center gap-[3vw] sm:gap-8">
        <button
          data-book-control
          type="button"
          onClick={prev}
          disabled={!canBack}
          className="ctl"
          aria-label="Previous page"
        >
          ‹
        </button>
        <p
          className="label min-w-[10ch] text-center [font-size:0.6rem]"
          aria-live="polite"
        >
          {closed
            ? "Cover"
            : finished
              ? "End"
              : `${currentPage} / ${PAGES.length - 2}`}
        </p>
        <button
          data-book-control
          type="button"
          onClick={next}
          disabled={!canForward}
          className="ctl"
          aria-label="Next page"
        >
          ›
        </button>
      </nav>
    </div>
  );
}
