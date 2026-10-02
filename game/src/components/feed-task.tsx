"use client";

/**
 * What a hand-in is proof *of*, on the feed and the post page.
 *
 * Without it a clip is just a stranger doing something odd; with it, it is
 * a dare met or missed — and a watcher deciding whether it passes needs the
 * same brief and checklist the player was given. So every post leads with
 * the task's title, then the brief, then (one tap away on the feed, open on
 * the post page) what the watchers check, and the prize the player is
 * playing for.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useId, useState } from "react";
import { Icon } from "@/components/icon";
import { Label } from "@/components/ui";
import type { FeedTask, SeasonDay } from "@/lib/api";
import { cn } from "@/lib/utils";

const OPAL: Record<SeasonDay, string> = { 1: "001", 2: "002", 3: "003" };

/** Above the media: what was dared, in the display face. */
export function FeedTaskTitle({
  task,
  day,
  size = "md",
}: {
  task: FeedTask;
  day: SeasonDay;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Label>Opal {OPAL[day]}</Label>
        <span aria-hidden className="size-1 bg-blue-dim" />
        <Label tone="muted">{task.mode === "team" ? "Team task" : "Solo task"}</Label>
      </div>
      <h2
        className={cn(
          "font-display uppercase text-ink text-glow pixel-snap text-balance",
          size === "lg"
            ? "text-[clamp(22px,6vw,36px)] leading-[1.05]"
            : "text-[clamp(17px,4.6vw,24px)] leading-[1.1]",
        )}
      >
        {task.title}
      </h2>
    </div>
  );
}

/**
 * Under the media: the brief, then the checklist and the prize. On the
 * feed the checklist folds away behind one line so the scroll stays a
 * scroll; on the post page it is open.
 */
export function FeedTaskDetails({
  task,
  defaultOpen = false,
}: {
  task: FeedTask;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const hasChecklist = task.criteria.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-body-sm leading-[20px] text-ink-muted">{task.brief}</p>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {hasChecklist ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className="group inline-flex min-h-9 items-center gap-2 font-pixel text-[9px] uppercase tracking-[0.14em] text-blue transition-colors hover:text-cyan"
          >
            <span
              aria-hidden
              className={cn("inline-block transition-transform duration-200", open && "rotate-90")}
            >
              ▶
            </span>
            {open ? "Hide the checklist" : "What the watchers check"}
          </button>
        ) : (
          <span />
        )}

        {/* The prize, in one line: what this was worth to the player. */}
        <span className="inline-flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="star" size="xs" glow />
            <span className="font-pixel text-[10px] tabular-nums text-cyan text-glow-cyan-xs">
              +{task.rewardNerve}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="opal" size="xs" glow="coin" />
            <span className="font-pixel text-[10px] tabular-nums text-coin text-glow-coin-xs">
              +{task.rewardCoins}
            </span>
          </span>
        </span>
      </div>

      <AnimatePresence initial={false}>
        {open && hasChecklist ? (
          <motion.ul
            id={panelId}
            key="checklist"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-2 overflow-hidden"
          >
            {task.criteria.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span aria-hidden className="mt-[3px] font-pixel text-[8px] text-cyan">
                  ■
                </span>
                <span className="font-body text-body-sm leading-[18px] text-ink-muted">
                  {line}
                </span>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
