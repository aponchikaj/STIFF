"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/hooks";
import { btnGhost } from "../ui";

/*
 * The pieces every game screen shares, on top of the panel's primitives.
 *
 * Anything generic — buttons, cards, badges, stats, tables — lives in
 * `../ui`. What is here is either specific to the game's data (hearts, a
 * demotion reason spelled out) or specific to operating it (arming an
 * irreversible action, reporting what the last one did).
 */

export { Badge as Pill, Stat, SectionTitle, Empty, Facts, Note } from "../ui";
export type { Tone } from "../ui";

/**
 * A button for something that cannot be taken back.
 *
 * The first press arms it, the second fires, and anything else disarms —
 * losing focus, or the row scrolling out from under the cursor. No browser
 * dialog: `confirm()` steals the whole window for a decision that belongs
 * next to the thing being decided, and its wording cannot say what will
 * actually happen.
 */
export function ConfirmButton({
  label,
  confirmLabel = "Press again",
  onConfirm,
  className = btnGhost,
  disabled,
  tone = "danger",
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
  disabled?: boolean;
  /** `danger` turns the armed state red; `neutral` leaves it plain. */
  tone?: "danger" | "neutral";
}) {
  const [armed, setArmed] = useState(false);
  const armedCls =
    tone === "danger" ? "text-danger underline" : "text-ink underline";
  return (
    <button
      type="button"
      disabled={disabled}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        void onConfirm();
      }}
      aria-pressed={armed}
      className={`${className} ${armed ? armedCls : ""}`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

/**
 * Runs an action, keeps its outcome as one line, then reloads.
 *
 * Failures land in the same place successes do. An error that appears
 * somewhere else is an error the operator learns to miss.
 */
export function useAction(reload?: () => void) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function act(
    action: () => Promise<unknown>,
    done?: string | ((result: unknown) => string),
  ) {
    setNote(null);
    setBusy(true);
    try {
      const result = await action();
      setNote(typeof done === "function" ? done(result) : (done ?? null));
      reload?.();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return { note, setNote, busy, act };
}

// ------------------------------------------------------------ the game's --

/**
 * Hearts as pips: filled for what is left, hollow for what is spent.
 *
 * A player's remaining hearts is the number that decides whether they are
 * still in the season, so it is shown as a shape you can count without
 * reading rather than as "2/3".
 */
export function Hearts({
  remaining,
  total,
}: {
  remaining: number;
  total: number;
}) {
  const left = Math.max(remaining, 0);
  const spent = Math.max(total - left, 0);
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`${left} of ${total} hearts left`}
    >
      {Array.from({ length: left }, (_, i) => (
        <span
          key={`on-${i}`}
          className={`inline-block size-1.5 rounded-full ${
            left === 1 ? "bg-danger" : "bg-ink"
          }`}
        />
      ))}
      {Array.from({ length: spent }, (_, i) => (
        <span
          key={`off-${i}`}
          className="inline-block size-1.5 rounded-full border border-line-strong"
        />
      ))}
    </span>
  );
}

/** The text form, for places a row is too tight for pips. */
export function hearts(remaining: number, total: number): string {
  return `${"●".repeat(Math.max(remaining, 0))}${"○".repeat(Math.max(total - remaining, 0))}`;
}

// ------------------------------------------------------------ formatting --

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3 min ago", "2 h ago", "4 d ago". Coarse on purpose. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return `${durationWords(seconds)} ago`;
}

export function durationWords(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "—";
}

/** A readable phrase from an id like `missed_daily_minimum`. */
export function words(id: string | null | undefined): string {
  return id ? id.replace(/_/g, " ") : "—";
}

/** Whole numbers with thousands separators, for anything counted. */
export function n(value: number): string {
  return value.toLocaleString("en-GB");
}
