"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Haze } from "@/components/crt";
import { CabinetMenu } from "@/components/ui";
import { Wordmark } from "@/components/wordmark";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { useSignedInRedirect } from "@/lib/queries";
import type { EnrolmentRole } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * The title screen.
 *
 * One question, asked the way an arcade cabinet asks DO YOU WANT TO
 * CONTINUE?: the mark, the question under it, and two answers on one line
 * with a ▶ caret on the selected one. The caret follows the pointer, focus
 * and the arrow keys, so it reads as a cabinet menu rather than two links.
 * Picking one is the whole sign-up decision, so each answer links straight
 * into `/join` with the side already chosen.
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
          className="mt-8 font-pixel text-[13px] uppercase tracking-[0.04em] text-cyan text-glow-cyan-xs sm:mt-10 sm:text-[18px]"
        >
          Are you a?
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5, ease }}
          className="mt-8 sm:mt-10"
        >
          <CabinetMenu
            label="Pick a side"
            size="lg"
            items={SIDES.map((side) => ({
              key: side,
              label: side,
              href: `/join?side=${side}`,
              // Player is the heart red: a player is the one with hearts to lose.
              tone: side === "player" ? "danger" : "blue",
            }))}
          />
        </motion.div>
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
          <p className="flex items-baseline gap-2 font-pixel text-[10px] uppercase tracking-[0.04em] text-ink-faint">
            If you already are a <CyclingRole />
          </p>

          <Link
            href="/login"
            className="group inline-flex min-h-11 items-center gap-2.5 px-1 font-pixel text-[12px] uppercase tracking-[0.04em] text-ink transition-all duration-200 [text-shadow:var(--glow-blue)] hover:text-cyan hover:[text-shadow:var(--glow-cyan-lg)]"
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
