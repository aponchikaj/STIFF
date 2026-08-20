"use client";

import { useState } from "react";
import { productsApi } from "@/lib/api";
import type { FitReport, FitValue, FitVerdict } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { useSession } from "./providers";

/**
 * How a piece fits, from the people who bought it.
 *
 * Three buckets rather than five stars, because "runs small / true / runs
 * large" is the question someone standing in front of a size chart actually
 * has — an average of 4.2 stars answers none of it. Only buyers can answer,
 * which is what makes the reading worth printing.
 */

const VERDICT_COPY: Record<FitVerdict, string> = {
  runs_small: "Runs small",
  true_to_size: "True to size",
  runs_large: "Runs large",
};

const OPTIONS: { value: FitValue; label: string }[] = [
  { value: -1, label: "Runs small" },
  { value: 0, label: "True to size" },
  { value: 1, label: "Runs large" },
];

export function FitRating({
  productId,
  initial,
}: {
  productId: string;
  initial: FitReport;
}) {
  const { user } = useSession();
  const [report, setReport] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function rate(value: FitValue) {
    setBusy(true);
    setNote(null);
    try {
      // Clicking the answer you already gave withdraws it, the same way the
      // like button works — a rating you can't take back is a rating people
      // hesitate to leave.
      setReport(
        report.mine === value
          ? await productsApi.clearFit(productId)
          : await productsApi.rateFit(productId, value),
      );
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const canRate = user && report.canRate;

  // Nothing to say and nobody who could say it: render nothing rather than an
  // empty widget promising data that will never arrive.
  if (!canRate && report.total === 0) return null;

  return (
    <div className="mt-8 border-t border-subtle pt-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
        Fit
      </p>

      {report.verdict && report.agreeing !== null ? (
        <>
          <p className="mt-2 text-sm font-medium">
            {VERDICT_COPY[report.verdict]}
          </p>
          <p className="mt-1 text-xs text-muted">
            {report.agreeing} of {report.total} buyers
          </p>
          <FitBars report={report} />
        </>
      ) : (
        <p className="mt-2 text-xs text-muted">
          {report.total === 0
            ? "No fit reports yet."
            : `${report.total} buyer${report.total === 1 ? "" : "s"} so far — not enough to call it.`}
        </p>
      )}

      {canRate && (
        <div className="mt-4">
          <p className="text-xs text-muted">
            You bought this. How did it fit?
          </p>
          <div
            role="radiogroup"
            aria-label="How this piece fits"
            className="mt-2 flex flex-wrap gap-2"
          >
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={report.mine === option.value}
                disabled={busy}
                onClick={() => rate(option.value)}
                className={`h-9 rounded-[2px] border px-3 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:opacity-40 ${
                  report.mine === option.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-subtle text-muted hover:border-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted">
            {note ?? (report.mine !== null ? "Saved. Click again to undo." : "")}
          </p>
        </div>
      )}
    </div>
  );
}

/** The spread behind the verdict — a lopsided 5/1/1 reads differently to 3/2/2. */
function FitBars({ report }: { report: FitReport }) {
  const rows: { label: string; count: number }[] = [
    { label: "Small", count: report.small },
    { label: "True", count: report.true },
    { label: "Large", count: report.large },
  ];
  return (
    <ul className="mt-3 flex max-w-xs flex-col gap-1.5">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
            {row.label}
          </span>
          <span
            aria-hidden
            className="h-1.5 flex-1 overflow-hidden rounded-[1px] bg-surface"
          >
            <span
              className="block h-full bg-foreground"
              style={{
                width: `${report.total > 0 ? (row.count / report.total) * 100 : 0}%`,
              }}
            />
          </span>
          <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-muted">
            {row.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
