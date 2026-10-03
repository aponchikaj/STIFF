"use client";

/**
 * Small pieces the shop screens share: money formatting, the price tag,
 * the two-step buy button, and the celebration when something is bought.
 */

import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { cn, formatNumber } from "@/lib/utils";

/**
 * Tetri to "5 GEL" or "4.50 GEL" — whole lari drop the ".00", which in a
 * 1em-per-glyph pixel face is three characters of nothing. The face has no
 * ₾ glyph, so the code it is.
 */
export function formatGel(cents: number): string {
  const lari = cents / 100;
  return `${cents % 100 === 0 ? formatNumber(lari) : lari.toFixed(2)} GEL`;
}

/** An opal amount, in the coin colour, with the opal mark. */
export function OpalPrice({
  amount,
  size = "md",
  dim = false,
}: {
  amount: number;
  size?: "sm" | "md" | "lg";
  dim?: boolean;
}) {
  const text = {
    sm: "text-[11px]",
    md: "text-[14px]",
    lg: "text-[clamp(26px,8vw,40px)]",
  }[size];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon
        name="opal"
        size={size === "lg" ? "md" : "xs"}
        glow={dim ? undefined : "coin"}
        dim={dim}
      />
      <span
        className={cn(
          "font-pixel leading-none tabular-nums",
          text,
          dim ? "text-ink-faint" : "text-coin text-glow-coin-xs",
          size === "lg" && !dim && "text-glow-coin",
        )}
      >
        {formatNumber(amount)}
      </span>
    </span>
  );
}

/**
 * A buy button that asks twice.
 *
 * The first press arms it — it turns amber and says "Tap again to pay" for
 * four seconds, with the time draining along its bottom edge — and only a
 * second press inside that window buys. Opals are earned slowly and can be
 * bought with money; a stray tap must not spend them. One button, not a
 * dialog over a sheet: the decision stays where the eye already is.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  busy,
  disabled,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  busy: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function press() {
    if (busy || disabled) return;
    if (armed) {
      window.clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = window.setTimeout(() => setArmed(false), 4000);
  }

  return (
    <span className={cn("block w-full", disabled ? "" : armed ? "bloom-coin" : "bloom-blue")}>
      <button
        type="button"
        onClick={press}
        disabled={disabled || busy}
        aria-live="polite"
        className={cn(
          "relative block w-full overflow-hidden py-4 font-pixel text-[13px] uppercase tracking-[0.12em] frame-notch transition-colors duration-200",
          disabled
            ? "cursor-not-allowed bg-surface-3 text-ink-faint"
            : armed
              ? "bg-coin text-void"
              : "bg-blue text-void hover:bg-cyan",
        )}
      >
        {busy ? (
          <span className="animate-[blink_0.7s_steps(2,end)_infinite]">▮▮▮</span>
        ) : armed ? (
          confirmLabel
        ) : (
          label
        )}
        {armed && !busy ? (
          <motion.span
            aria-hidden
            className="absolute bottom-0 left-0 h-1 bg-void/40"
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: 4, ease: "linear" }}
          />
        ) : null}
      </button>
    </span>
  );
}

/** Opal-coloured confetti, once, unless the reader asked for less motion. */
export function useCelebrate(): () => void {
  const reduced = usePrefersReducedMotion();
  return () => {
    if (reduced) return;
    void confetti({
      particleCount: 90,
      spread: 75,
      startVelocity: 38,
      origin: { y: 0.65 },
      colors: ["#01e7ff", "#01a3ff", "#9ff5ff", "#ffc227", "#ffffff"],
      shapes: ["square"],
      scalar: 0.9,
      disableForReducedMotion: true,
    });
  };
}

/** The moment after buying: what you got, and where it went. */
export function Bought({
  title,
  detail,
  onDone,
}: {
  title: string;
  detail: string;
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-5 px-6 py-12 text-center"
      role="status"
    >
      <motion.span
        initial={{ rotate: -12, scale: 0.6 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
      >
        <Icon name="gift" size="2xl" glow="lg" />
      </motion.span>
      <span className="font-pixel text-[18px] uppercase tracking-[0.1em] text-good [text-shadow:0_0_4px_rgb(47_217_107/0.9),0_0_16px_rgb(47_217_107/0.5)]">
        {title}
      </span>
      <p className="max-w-xs font-body text-body-sm leading-[20px] text-ink-muted">{detail}</p>
      <button
        type="button"
        onClick={onDone}
        className="mt-2 font-pixel text-[11px] uppercase tracking-[0.14em] text-blue hover:text-cyan"
      >
        ▶ Back to the shop
      </button>
    </motion.div>
  );
}
