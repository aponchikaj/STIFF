"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SLIDES, folio } from "@/content/deck";
import { SlideView } from "./slide";

const TOTAL = SLIDES.length;
const EASE = [0.16, 1, 0.3, 1] as const;
/** Below this, or in portrait, a 16:9 stage sets body type at eight pixels. */
const READ_QUERY =
  "(max-width: 699px), ((orientation: portrait) and (max-width: 1024px))";
const HUD_IDLE_MS = 2800;
const SWIPE_PX = 56;

function clamp(n: number): number {
  return Math.max(0, Math.min(TOTAL - 1, n));
}

function readHash(): number {
  const m = /^#\/?(\d+)/.exec(window.location.hash);
  return m ? clamp(parseInt(m[1], 10) - 1) : 0;
}

/**
 * The URL is the slide state. `#/7` is slide seven, so a slide can be linked,
 * a reload lands where the presenter was, and the browser's back button steps
 * back through the deck. React reads it as an external store rather than
 * copying it into state.
 */
function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function subscribeMedia(cb: () => void) {
  const mq = window.matchMedia(READ_QUERY);
  mq.addEventListener("change", cb);
  window.addEventListener("resize", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("resize", cb);
  };
}

const readMedia = () => window.matchMedia(READ_QUERY).matches;

export function Deck() {
  const index = useSyncExternalStore(subscribeHash, readHash, () => 0);
  const forcedRead = useSyncExternalStore(subscribeMedia, readMedia, () => false);
  const [read, setRead] = useState(false);
  const [notes, setNotes] = useState(false);
  const [help, setHelp] = useState(false);
  const [hud, setHud] = useState(true);
  const reduce = useReducedMotion();

  const hudTimer = useRef<number | null>(null);
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const slide = SLIDES[index];
  const isRead = read || forcedRead;

  // --- Navigation -------------------------------------------------------------
  const go = useCallback((n: number) => {
    window.location.hash = `#/${clamp(n) + 1}`;
  }, []);
  const next = useCallback(() => go(readHash() + 1), [go]);
  const prev = useCallback(() => go(readHash() - 1), [go]);

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
      if (e.key === "Escape") {
        setHelp(false);
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setRead((r) => !r);
        return;
      }
      if (isRead) return;

      switch (e.key) {
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
          go(0);
          break;
        case "End":
          e.preventDefault();
          go(TOTAL - 1);
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "n":
        case "N":
          e.preventDefault();
          setNotes((n) => !n);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRead, next, prev, go, toggleFullscreen]);

  // --- HUD ------------------------------------------------------------------
  // Controls show on any movement and fade when the room goes still, so a
  // projected slide is only the slide.
  const wake = useCallback(() => {
    setHud(true);
    if (hudTimer.current) window.clearTimeout(hudTimer.current);
    hudTimer.current = window.setTimeout(() => setHud(false), HUD_IDLE_MS);
  }, []);

  useEffect(() => {
    if (isRead) return;
    hudTimer.current = window.setTimeout(() => setHud(false), HUD_IDLE_MS);
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
      if (hudTimer.current) window.clearTimeout(hudTimer.current);
    };
  }, [isRead, wake]);

  // --- Pointer --------------------------------------------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s) return;
    if (Math.abs(e.clientX - s.x) > 8 || Math.abs(e.clientY - s.y) > 8) {
      s.moved = true;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) next();
      else prev();
      return;
    }
    if (s.moved) return;
    // A tap: the right two thirds advance, the left third goes back — the
    // convention every slide tool shares, and what a hand holding a clicker
    // expects when it reaches for the trackpad instead.
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if ((e.clientX - rect.left) / rect.width < 0.33) prev();
    else next();
  };

  // --- Reading mode ---------------------------------------------------------
  if (isRead) {
    return (
      <div className="deck read" data-theme="light">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--rule)] bg-[var(--bg)]/90 px-4 py-3 backdrop-blur sm:px-8">
          <p className="t-eyebrow text-[0.7rem]!">
            STIFF · investor deck · reading version
          </p>
          <div className="flex gap-2">
            {!forcedRead ? (
              <button
                type="button"
                className="ctl"
                onClick={() => setRead(false)}
              >
                Present
              </button>
            ) : null}
            <button
              type="button"
              className="ctl"
              onClick={() => window.print()}
            >
              Print
            </button>
          </div>
        </header>

        <div className="deck-viewport">
          {SLIDES.map((s, i) => (
            <section key={s.id} className="sheet" data-theme={s.theme}>
              <SlideView slide={s} index={i} total={TOTAL} />
              <div className="notes" data-theme="light">
                <p className="t-eyebrow text-[0.65rem]! tracking-[0.2em]!">
                  Notes · {folio(i)}
                </p>
                {s.notes.map((n, k) => (
                  <p key={k}>{n}</p>
                ))}
                {!forcedRead ? (
                  <button
                    type="button"
                    className="ctl mt-2"
                    onClick={() => {
                      go(i);
                      setRead(false);
                    }}
                  >
                    Present from here
                  </button>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // --- Present mode ---------------------------------------------------------
  return (
    <div
      className={`deck ${notes ? "has-notes" : ""}`}
      data-theme={slide.theme}
    >
      <div
        className="deck-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipe.current = null)}
      >
        <div className="stage">
          <div
            className="stage-inner"
            tabIndex={0}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${index + 1} of ${TOTAL}: ${slide.title}`}
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={slide.id}
                className="absolute inset-0"
                initial={{ opacity: 0, y: reduce ? 0 : 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -10 }}
                transition={{ duration: reduce ? 0 : 0.55, ease: EASE }}
              >
                <SlideView slide={slide} index={index} total={TOTAL} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <nav
          className={`hud ${hud || help ? "" : "hidden-hud"}`}
          aria-label="Deck controls"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="ctl"
            onClick={prev}
            disabled={index === 0}
            aria-label="Previous slide"
          >
            ‹
          </button>
          <span className="hud-counter num" aria-live="polite">
            {folio(index)} / {TOTAL}
          </span>
          <button
            type="button"
            className="ctl"
            onClick={next}
            disabled={index === TOTAL - 1}
            aria-label="Next slide"
          >
            ›
          </button>
          <span className="mx-2 h-5 w-px bg-[var(--rule)]" aria-hidden />
          <button
            type="button"
            className="ctl"
            aria-pressed={notes}
            onClick={() => setNotes((n) => !n)}
          >
            Notes
          </button>
          <button type="button" className="ctl" onClick={() => setRead(true)}>
            Read
          </button>
          <button type="button" className="ctl" onClick={toggleFullscreen}>
            Full
          </button>
          <button
            type="button"
            className="ctl"
            aria-label="Keyboard shortcuts"
            aria-pressed={help}
            onClick={() => setHelp((h) => !h)}
          >
            ?
          </button>
        </nav>
      </div>

      {notes ? (
        <aside className="notes-drawer" aria-label="Speaker notes">
          <p className="t-eyebrow text-[0.68rem]!">
            Notes · {folio(index)} · {slide.section}
          </p>
          {slide.notes.map((n, k) => (
            <p key={k}>{n}</p>
          ))}
        </aside>
      ) : null}

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
                  <td>Next slide. Tap or click the right two thirds.</td>
                </tr>
                <tr>
                  <td>
                    <kbd>←</kbd> <kbd>⇧ Space</kbd> <kbd>PgUp</kbd>
                  </td>
                  <td>Previous slide. Tap the left third, or swipe.</td>
                </tr>
                <tr>
                  <td>
                    <kbd>Home</kbd> / <kbd>End</kbd>
                  </td>
                  <td>First / last slide.</td>
                </tr>
                <tr>
                  <td>
                    <kbd>N</kbd>
                  </td>
                  <td>Speaker notes under the stage.</td>
                </tr>
                <tr>
                  <td>
                    <kbd>R</kbd>
                  </td>
                  <td>Reading version — every slide with its notes, printable.</td>
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
                  <td>This card. The URL always carries the slide number.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
