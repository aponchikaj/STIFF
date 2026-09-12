"use client";

import { useState } from "react";
import { btnGhostSm, eyebrowCls } from "../ui";
import { errorMessage } from "@/lib/hooks";

/* Small pieces every game screen shares, so the eight of them read as one. */

export type Tone = "neutral" | "solid" | "outline" | "warn";

/** A status word. `solid` is the emphatic state, `warn` the one to look at. */
export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  const cls =
    tone === "solid"
      ? "bg-foreground text-background"
      : tone === "warn"
        ? "border border-foreground text-foreground"
        : tone === "outline"
          ? "border border-subtle text-foreground"
          : "border border-subtle text-muted";
  return (
    <span
      className={`inline-flex rounded-[2px] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] ${cls}`}
    >
      {children}
    </span>
  );
}

/** One number with a label under it. A row of these is the summary strip. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="border-t border-subtle pt-3">
      <p className={eyebrowCls}>{label}</p>
      <p className="mt-2 text-3xl tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
      <h3 className="text-sm font-bold uppercase tracking-[0.15em]">
        {children}
      </h3>
      {aside}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-sm text-muted">{children}</p>;
}

/** Key–value rows for a detail pane. */
export function Facts({
  rows,
}: {
  rows: { label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-xs">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted">{row.label}</dt>
          <dd className="min-w-0 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A button for an action that cannot be taken back. The first press arms it,
 * the second fires; anything else disarms. No modal, and no browser dialog.
 */
export function ConfirmButton({
  label,
  confirmLabel = "Sure?",
  onConfirm,
  className = btnGhostSm,
  disabled,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
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
      className={className}
      aria-pressed={armed}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

/** Runs an action, keeps its outcome as a one-line note, then reloads. */
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

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted">
      {children}
    </p>
  );
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
  return durationWords(seconds) + " ago";
}

export function durationWords(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

export function hearts(remaining: number, total: number): string {
  return `${"●".repeat(Math.max(remaining, 0))}${"○".repeat(Math.max(total - remaining, 0))}`;
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "—";
}

/** A readable word for a reason id like `missed_daily_minimum`. */
export function words(id: string | null | undefined): string {
  return id ? id.replace(/_/g, " ") : "—";
}
