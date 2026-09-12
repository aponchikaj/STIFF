"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { SLIDES } from "@/content/deck";
import { BlankPage, PageFace } from "./page";
import { useBook } from "./use-book";

/**
 * The journal.
 *
 * A stack of leaves standing in a stage that is as tall as the viewport
 * allows. Wide screens get a two-page spread; anything narrower than a small
 * laptop, or in portrait, gets one tall page. The URL is the page state —
 * `#/7` is page seven, the same scheme the slide deck at /deck uses, so a
 * link works in both.
 */

const TOTAL = SLIDES.length;
/** Must match `--turn-ms` in globals.css. */
const TURN_MS = 900;
const SPREAD_QUERY = "(min-width: 900px) and (min-height: 540px)";
/** Leaves this far from the open one carry real pages; the rest are blank. */
const NEAR = 2;
/** px of page-block edge per leaf. */
const EDGE_PX = 1.4;

const clampPage = (n: number) => Math.max(0, Math.min(TOTAL - 1, n));

function readHash(): number {
  const m = /^#\/?(\d+)/.exec(window.location.hash);
  return m ? clampPage(parseInt(m[1], 10) - 1) : 0;
}

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function subscribeMedia(cb: () => void) {
  const mq = window.matchMedia(SPREAD_QUERY);
  // `change` alone can be missed on an orientation flip and under devtools
  // emulation, which strands the book in the wrong mode.
  mq.addEventListener("change", cb);
  window.addEventListener("resize", cb);
  window.addEventListener("orientationchange", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("resize", cb);
    window.removeEventListener("orientationchange", cb);
  };
}

const readSpread = () => window.matchMedia(SPREAD_QUERY).matches;
const subscribeNoop = () => () => {};

export function Journal() {
  const page = useSyncExternalStore(subscribeHash, readHash, () => 0);
  const spread = useSyncExternalStore(subscribeMedia, readSpread, () => false);
  // The server renders one page; the real mode is only known in the browser.
  // The stage stays invisible until then so a laptop never paints a phone
  // layout first.
  const ready = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [help, setHelp] = useState(false);

  const ppl: 1 | 2 = spread ? 2 : 1;
  const leafCount = Math.ceil(TOTAL / ppl);
  // Turning the last leaf is only legal when it has a page on its back.
  const maxTurned = spread
    ? TOTAL % 2 === 0
      ? leafCount
      : leafCount - 1
    : leafCount - 1;
  const turned = Math.min(maxTurned, spread ? Math.ceil(page / 2) : page);

  const goTurned = useCallback(
    (t: number) => {
      const tt = Math.max(0, Math.min(maxTurned, t));
      const p = spread ? Math.min(TOTAL - 1, 2 * tt) : tt;
      window.location.hash = `#/${p + 1}`;
    },
    [spread, maxTurned],
  );

  const onTap = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      // A spread turns the page you touch. One page follows the slide
      // convention: the left third goes back, the rest goes on.
      const back = spread ? x < 0.5 : x < 0.33;
      goTurned(turned + (back ? -1 : 1));
    },
    [spread, turned, goTurned],
  );

  const {
    surfaceRef,
    setLeafRef,
    dragging,
    frozen,
    lifted,
    zFor,
    next,
    prev,
    goTo,
    canForward,
    canBack,
    handlers,
  } = useBook({
    leafCount,
    maxTurned,
    turned,
    pagesPerLeaf: ppl,
    turnMs: TURN_MS,
    onTurned: goTurned,
    onTap,
    live: ready,
  });

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelp((h) => !h);
        return;
      }
      switch (e.key) {
        case "Escape":
          setHelp(false);
          break;
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case "Enter":
          e.preventDefault();
          next();
          break;
        case " ":
          e.preventDefault();
          if (e.shiftKey) prev();
          else next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
        case "Backspace":
          e.preventDefault();
          prev();
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(maxTurned);
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo, maxTurned, toggleFullscreen]);

  const closed = turned === 0;
  const finished = spread && turned === maxTurned;
  // Closed, the cover sits in the middle of the screen rather than in the
  // right half of an invisible spread, so the whole book slides half a page
  // across and slides back as it opens. Mirrored at the far end.
  const shift = spread ? (closed ? "-25%" : finished ? "25%" : "0%") : "0%";

  const counter = closed
    ? "Cover"
    : finished
      ? "End"
      : spread
        ? `${2 * turned}–${2 * turned + 1} / ${TOTAL}`
        : `${turned + 1} / ${TOTAL}`;

  const leaves = Array.from({ length: leafCount }, (_, i) => i);

  return (
    <div className="journal" data-theme="light">
      <div className="journal-main">
        <div
          className={`book-stage ${spread ? "is-spread" : "is-single"} ${ready ? "is-ready" : ""}`}
          style={{ transform: `translateX(${shift})` }}
        >
          <div className="book-shadow book-shadow-l" style={{ opacity: closed ? 0 : 1 }} aria-hidden />
          <div className="book-shadow book-shadow-r" style={{ opacity: finished ? 0 : 1 }} aria-hidden />
          <span
            className="book-edge book-edge-l"
            style={{ width: `${turned * EDGE_PX}px` }}
            aria-hidden
          />
          <span
            className="book-edge book-edge-r"
            style={{ width: `${(leafCount - turned) * EDGE_PX}px` }}
            aria-hidden
          />

          <div
            ref={surfaceRef}
            className={`book-surface ${dragging ? "is-dragging" : ""} ${frozen ? "is-frozen" : ""}`}
            role="group"
            aria-roledescription="journal"
            aria-label={`STIFF journal, ${counter}. Use the arrow keys, or drag a page, to turn.`}
            tabIndex={0}
            {...handlers}
          >
            {leaves.map((i) => {
              const front = SLIDES[i * ppl];
              const back = spread ? SLIDES[i * 2 + 1] : undefined;
              const isTurned = i < turned;
              const near = i >= turned - 1 - NEAR && i <= turned + NEAR;
              const style: CSSProperties & { "--p": number } = {
                zIndex: zFor(i),
                transform: `rotateY(${isTurned ? -180 : 0}deg)`,
                "--p": isTurned ? 1 : 0,
              };
              return (
                <div
                  key={i}
                  ref={setLeafRef(i)}
                  className={`leaf ${isTurned ? "is-turned" : ""} ${lifted.has(i) ? "is-lifted" : ""}`}
                  style={style}
                >
                  <div className="leaf-face leaf-front" aria-hidden={isTurned}>
                    {near && front ? (
                      <PageFace slide={front} index={i * ppl} total={TOTAL} side="recto" />
                    ) : (
                      <BlankPage />
                    )}
                  </div>
                  <div className="leaf-face leaf-back" aria-hidden={!isTurned}>
                    {near && back ? (
                      <PageFace slide={back} index={i * 2 + 1} total={TOTAL} side="verso" />
                    ) : (
                      <BlankPage />
                    )}
                  </div>
                  {/* Shadows the lifted leaf casts on the pages beneath it.
                      Counter-rotated so they lie flat, scaled to the leaf's
                      projection, strongest halfway through the turn. */}
                  <span className="leaf-cast leaf-cast-r" aria-hidden />
                  <span className="leaf-cast leaf-cast-l" aria-hidden />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <nav className="journal-hud" aria-label="Journal controls">
        <button
          data-book-control
          type="button"
          className="ctl"
          onClick={prev}
          disabled={!canBack}
          aria-label="Previous page"
        >
          ‹
        </button>
        <span className="hud-counter num" aria-live="polite">
          {counter}
        </span>
        <button
          data-book-control
          type="button"
          className="ctl"
          onClick={next}
          disabled={!canForward}
          aria-label="Next page"
        >
          ›
        </button>
        <span className="mx-2 h-5 w-px bg-[var(--rule)]" aria-hidden />
        <Link href="/deck" className="ctl" data-book-control>
          Slides
        </Link>
        <button
          data-book-control
          type="button"
          className="ctl ctl-wide"
          onClick={toggleFullscreen}
        >
          Full
        </button>
        <button
          data-book-control
          type="button"
          className="ctl"
          aria-label="Keyboard shortcuts"
          aria-pressed={help}
          onClick={() => setHelp((h) => !h)}
        >
          ?
        </button>
      </nav>

      {help ? (
        <div
          className="help"
          role="dialog"
          aria-label="Keyboard shortcuts"
          onClick={() => setHelp(false)}
        >
          <div className="help-card" onClick={(e) => e.stopPropagation()}>
            <p className="t-eyebrow text-[0.7rem]!">Keyboard</p>
            <table>
              <tbody>
                <tr>
                  <td>
                    <kbd>→</kbd> <kbd>Space</kbd> <kbd>PgDn</kbd>
                  </td>
                  <td>Turn the page. Or drag it, flick it, or tap the right side.</td>
                </tr>
                <tr>
                  <td>
                    <kbd>←</kbd> <kbd>⇧ Space</kbd> <kbd>PgUp</kbd>
                  </td>
                  <td>Turn back. Or drag the left page, or tap it.</td>
                </tr>
                <tr>
                  <td>
                    <kbd>Home</kbd> / <kbd>End</kbd>
                  </td>
                  <td>Cover / back page.</td>
                </tr>
                <tr>
                  <td>
                    <kbd>F</kbd>
                  </td>
                  <td>Fullscreen.</td>
                </tr>
                <tr>
                  <td>
                    <kbd>?</kbd>
                  </td>
                  <td>This card. The URL always carries the page number; /deck is the same content as 16:9 slides.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
