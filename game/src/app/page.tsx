"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Haze } from "@/components/crt";
import { Wordmark } from "@/components/wordmark";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { useSignedInRedirect } from "@/lib/queries";
import type { EnrolmentRole } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * The title screen.
 *
 * One question, asked as a layout: the mark, "are you a", and the two
 * answers either side of it. Picking one is the whole sign-up decision, so
 * each answer links straight into `/join` with the side already chosen.
 *
 * The footer is for the people who already answered it. The role in it
 * cycles because a returning visitor could be either, and naming both in
 * turn reads as "this means you" rather than as a generic "sign in".
 *
 * An intro video will play in front of this later; nothing here depends on
 * it, so it can be layered on without touching the layout.
 */

const SIDES: EnrolmentRole[] = ["watcher", "player"];
const CYCLE_MS = 3000;

const ease = [0.16, 1, 0.3, 1] as const;

export default function TitleScreen() {
  // A returning player or watcher goes straight home. Signed in without a
  // side stays — this screen is where a side is picked.
  const { pending, isSignedIn } = useSignedInRedirect();

  if (pending) {
    // Just the tube, no question: nothing here is for them.
    return (
      <main className="relative min-h-dvh overflow-hidden">
        <Haze intensity="lg" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden px-4">
      <Haze intensity="lg" />

      <div className="flex w-full flex-1 flex-col items-center justify-center py-16">
        <Wordmark />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-10 font-pixel text-[10px] uppercase tracking-[0.3em] text-ink-muted sm:text-[12px]"
        >
          Are you a
        </motion.p>

        <nav
          aria-label="Pick a side"
          className="mt-8 flex w-full max-w-2xl items-center justify-between gap-3 sm:gap-6 sm:px-8"
        >
          <SideLink side="watcher" delay={0.7} />
          <span aria-hidden className="h-8 w-px bg-blue-dim" />
          <SideLink side="player" delay={0.8} />
        </nav>
      </div>

      {/* For people who already answered — but not someone signed in who is
          only here because they have no side yet. */}
      {isSignedIn ? null : (
        <motion.footer
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5, ease }}
          className="flex flex-col items-center gap-4 pb-10"
        >
          <p className="flex items-baseline gap-2 font-body text-caption uppercase tracking-[0.15em] text-ink-faint">
            If you already are a <CyclingRole />
          </p>

          <Link
            href="/login"
            className="group inline-flex min-h-11 items-center gap-2.5 px-1 font-pixel text-[12px] uppercase tracking-[0.12em] text-ink transition-all duration-200 [text-shadow:var(--glow-blue)] hover:text-cyan hover:[text-shadow:var(--glow-cyan-lg)]"
          >
            <span
              aria-hidden
              className="inline-block w-2 -translate-x-1 text-cyan opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
            >
              ▶
            </span>
            Log in
          </Link>
        </motion.footer>
      )}
    </main>
  );
}

/**
 * One answer to "are you a". Watcher is blue; player is red — the heart
 * colour, because a player is the one with hearts to lose.
 */
function SideLink({ side, delay }: { side: EnrolmentRole; delay: number }) {
  const watcher = side === "watcher";

  return (
    <motion.div
      initial={{ opacity: 0, x: watcher ? -12 : 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease }}
      className="flex flex-1 justify-center"
    >
      <Link
        href={`/join?side=${side}`}
        className={cn(
          "group relative inline-flex min-h-14 items-center px-2 font-pixel text-[14px] uppercase tracking-[0.14em] transition-all duration-200 sm:text-[24px]",
          watcher
            ? "text-blue [text-shadow:var(--glow-blue)] hover:text-cyan hover:[text-shadow:var(--glow-cyan-lg)]"
            : "text-heart [text-shadow:var(--glow-heart)] hover:text-danger hover:[text-shadow:0_0_6px_rgb(255_59_48/1),0_0_22px_rgb(255_59_48/0.7)]",
        )}
      >
        <span
          aria-hidden
          // Out of flow, so the arrow cannot push the word off a phone screen.
          className={cn(
            "absolute -left-3 -translate-x-1 text-[0.6em] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
            watcher ? "text-cyan" : "text-heart",
          )}
        >
          ▶
        </span>
        {side}
      </Link>
    </motion.div>
  );
}

/**
 * WATCHER, then PLAYER, every three seconds. Under reduced motion it still
 * changes — the swap is content, not decoration — but without the slide.
 */
function CyclingRole() {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setIndex((current) => (current + 1) % SIDES.length),
      CYCLE_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  const side = SIDES[index];

  return (
    <span className="relative inline-flex overflow-hidden" aria-live="off">
      {/* sized by the longer word so the line does not jump */}
      <span aria-hidden className="invisible font-pixel text-[10px]">
        WATCHER
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={side}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: "-100%" }}
          transition={{ duration: 0.3, ease }}
          className={cn(
            "absolute inset-0 font-pixel text-[10px]",
            side === "watcher"
              ? "text-blue [text-shadow:var(--glow-blue-sm)]"
              : "text-heart [text-shadow:var(--glow-heart)]",
          )}
        >
          {side}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
