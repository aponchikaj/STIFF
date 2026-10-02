"use client";

import { motion } from "framer-motion";
import { useCountdown, usePrefersReducedMotion } from "@/lib/hooks";
import { cn, formatClock } from "@/lib/utils";
import { Label } from "./ui";

/**
 * The countdown on an accepted task.
 *
 * This is the most important number in the game and it is allowed to
 * behave like it. Three bands, because a clock that looks the same at
 * 28:00 and at 00:20 is not telling you anything:
 *
 *   > 5 min   cyan, steady. Plenty of time, no drama.
 *   ≤ 5 min   amber, breathing. Something to notice.
 *   ≤ 60 sec  red, pulsing on the second. Now it is a problem.
 *
 * The digits are `tabular-nums` and the container is width-stable, because
 * a clock whose layout shifts as digits change is a clock nobody can read
 * at a glance. Time comes from `useCountdown`, which derives from the
 * server's `expiresAt` rather than decrementing — a backgrounded phone
 * wakes up correct instead of minutes behind.
 */
export function Clock({
  expiresAt,
  onExpire,
  size = "lg",
  label = "Time left",
}: {
  expiresAt: string | null | undefined;
  onExpire?: () => void;
  size?: "md" | "lg" | "xl";
  label?: string;
}) {
  const seconds = useCountdown(expiresAt, onExpire);
  const reduced = usePrefersReducedMotion();

  const critical = seconds <= 60;
  const warning = !critical && seconds <= 300;
  const dead = seconds === 0;

  const tone = dead
    ? "text-ink-faint"
    : critical
      ? "text-danger [text-shadow:0_0_6px_rgb(255_59_48/1),0_0_24px_rgb(255_59_48/0.7),0_0_60px_rgb(255_59_48/0.35)]"
      : warning
        ? "text-caution [text-shadow:0_0_5px_rgb(255_176_32/0.95),0_0_20px_rgb(255_176_32/0.55)]"
        : "text-cyan text-glow-lg";

  const sizes = {
    md: "text-[28px] leading-8",
    lg: "text-[clamp(44px,13vw,72px)] leading-[1]",
    xl: "text-[clamp(60px,20vw,120px)] leading-[1]",
  } as const;

  return (
    <div className="flex flex-col items-center gap-3">
      <Label tone={critical ? "heart" : "faint"}>{dead ? "Time up" : label}</Label>

      <motion.span
        // The pulse is on the whole display, once a second, and only in the
        // last minute. Animating earlier would make the normal state feel
        // urgent and leave nowhere to escalate to.
        animate={
          critical && !dead && !reduced ? { scale: [1, 1.04, 1] } : { scale: 1 }
        }
        transition={
          critical && !dead && !reduced
            ? { duration: 1, repeat: Infinity, ease: "easeOut" }
            : { duration: 0.2 }
        }
        className={cn(
          "font-pixel tabular-nums transition-colors duration-500",
          sizes[size],
          tone,
        )}
      >
        {formatClock(seconds)}
      </motion.span>
    </div>
  );
}

/**
 * A thin horizontal gauge for the same number.
 *
 * Used where a full clock would dominate — a task card in a list, the
 * header of a hand-in sheet. Drains left to right and takes the same three
 * colour bands as `Clock`, so the two always agree at a glance.
 */
export function ClockBar({
  expiresAt,
  totalSeconds,
  className,
}: {
  expiresAt: string | null | undefined;
  /** The full clock in seconds, so the bar knows what "full" is. */
  totalSeconds: number;
  className?: string;
}) {
  const seconds = useCountdown(expiresAt);
  const fraction = totalSeconds > 0 ? Math.min(1, seconds / totalSeconds) : 0;

  const critical = seconds <= 60;
  const warning = !critical && seconds <= 300;

  return (
    <div className={cn("flex w-full items-center gap-3", className)}>
      <div className="relative h-0.5 flex-1 bg-blue-dim/40">
        <motion.div
          className={cn(
            "absolute inset-y-0 left-0",
            critical
              ? "bg-danger shadow-[0_0_8px_rgb(255_59_48/0.9)]"
              : warning
                ? "bg-caution shadow-[0_0_8px_rgb(255_176_32/0.8)]"
                : "bg-cyan shadow-[var(--glow-cyan)]",
          )}
          animate={{ width: `${fraction * 100}%` }}
          transition={{ duration: 0.3, ease: "linear" }}
        />
      </div>
      <span
        className={cn(
          "shrink-0 font-pixel text-[10px] tabular-nums",
          critical ? "text-danger" : warning ? "text-caution" : "text-cyan",
        )}
      >
        {formatClock(seconds)}
      </span>
    </div>
  );
}
