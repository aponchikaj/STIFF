"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Haze } from "@/components/crt";
import { Icon } from "@/components/icon";
import { CabinetMenu, Display, PixelHeart } from "@/components/ui";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/**
 * The 404, as the game would tell it: an arcade continue screen.
 *
 * The joke is the game's own rules applied to a page — it was dealt a task,
 * declined it, lost its last heart and got demoted to the audience. So the
 * screen plays that out: three hearts break one by one, then the classic
 * CONTINUE? countdown runs 9 → 0 and the tube settles on the cabinet's own
 * last screen — GAME OVER, DO YOU WANT TO CONTINUE?, ▶ YES  NO. The menu
 * is on screen the whole time; nothing redirects on its own, because a
 * page that moves you somewhere you did not ask to go is a second wrong
 * turn.
 *
 * Reduced motion keeps every beat — the hearts still empty, the count still
 * falls — and drops the shaking and the glitch.
 */
const HEARTS = 3;
const COUNT_FROM = 9;

export function NotFoundScreen() {
  const reduced = usePrefersReducedMotion();

  // Hearts first (one every 700ms), then the countdown (one a second).
  const [lost, setLost] = useState(0);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (lost >= HEARTS) {
      const id = window.setTimeout(() => setCount(COUNT_FROM), 600);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setLost((n) => n + 1), lost === 0 ? 1100 : 700);
    return () => window.clearTimeout(id);
  }, [lost]);

  useEffect(() => {
    if (count === null || count <= 0) return;
    const id = window.setTimeout(() => setCount((n) => (n === null ? n : n - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [count]);

  const over = count === 0;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-14 text-center">
      <Haze intensity="lg" />

      <Label>Stage not found</Label>

      {/* the number — chromatic, glitching, with a heart for the zero */}
      <h1
        className={cn(
          "mt-6 flex items-center justify-center gap-[0.08em] font-display text-[clamp(84px,26vw,200px)] leading-none pixel-snap phosphor",
          !reduced && "animate-glitch",
        )}
        aria-label="404"
      >
        <span aria-hidden>4</span>
        <motion.span
          aria-hidden
          className="inline-flex"
          animate={!reduced && !over ? { rotate: [0, -6, 6, 0] } : undefined}
          transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2.2 }}
        >
          <Icon name="broken-heart" size={140} glow="heart" className="h-[1em] w-auto" />
        </motion.span>
        <span aria-hidden>4</span>
      </h1>

      {/* the joke */}
      <div className="mt-8 flex max-w-md flex-col items-center gap-4">
        <p className="font-pixel text-[clamp(12px,3.4vw,16px)] uppercase leading-[1.6] tracking-[0.04em] text-ink text-glow-xs">
          This page declined its task.
        </p>
        <p className="font-body text-body-sm leading-[20px] text-ink-muted">
          It lost its last heart and got demoted to watcher. Last seen in the
          feed, voting <span className="text-heart">NO</span> on other pages.
        </p>
      </div>

      {/* the hearts, breaking */}
      <div
        className="mt-8 flex items-center gap-3"
        role="img"
        aria-label={`${HEARTS - lost} of ${HEARTS} hearts`}
      >
        {Array.from({ length: HEARTS }, (_, i) => {
          const alive = i >= lost;
          return (
            <motion.span
              key={i}
              animate={
                !alive && !reduced
                  ? { x: [0, -5, 5, -3, 3, 0], scale: [1, 1.25, 0.9, 1] }
                  : undefined
              }
              transition={{ duration: 0.45 }}
            >
              <PixelHeart alive={alive} size={28} />
            </motion.span>
          );
        })}
      </div>

      {/* continue? */}
      <div className="mt-10 flex min-h-[112px] flex-col items-center justify-center gap-3">
        <AnimatePresence mode="wait">
          {count === null ? (
            <motion.span
              key="wait"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-pixel text-[10px] uppercase tracking-[0.08em] text-ink-faint"
            >
              Hearts {HEARTS - lost}/{HEARTS}
            </motion.span>
          ) : over ? (
            <motion.div
              key="over"
              initial={{ opacity: 0, scale: 1.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-4"
            >
              <Display size="mega">Game over</Display>
              <span className="font-pixel text-[12px] uppercase tracking-[0.04em] text-cyan text-glow-cyan-xs sm:text-[15px]">
                Do you want to continue?
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="count"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <span className="font-pixel text-[12px] uppercase tracking-[0.08em] text-cyan text-glow-cyan-xs">
                Continue?
              </span>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={count}
                  initial={{ opacity: 0, scale: 1.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.25 }}
                  className="font-pixel text-[clamp(44px,13vw,64px)] leading-none tabular-nums text-cyan text-glow-lg"
                  aria-live="off"
                >
                  {count}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* the ways out — the cabinet's own: YES plays, NO goes to the title */}
      <CabinetMenu
        label="Ways out"
        className="mt-8"
        items={[
          { key: "yes", label: over ? "Yes" : "Play", href: "/play" },
          { key: "no", label: over ? "No" : "Title", href: "/", tone: "danger" },
        ]}
      />

      <p className="mt-12 font-pixel text-[9px] uppercase tracking-[0.08em] text-ink-faint">
        High score 404 · pages found 0
      </p>
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-pixel text-[10px] uppercase tracking-[0.08em] text-blue text-glow-blue">
      {children}
    </span>
  );
}
