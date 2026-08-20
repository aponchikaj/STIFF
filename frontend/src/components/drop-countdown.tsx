"use client";

import { useEffect, useState } from "react";
import { formatCountdown, msUntilDrop } from "@/lib/preorder";

/**
 * Ticking countdown to a drop.
 *
 * Renders nothing once the moment passes rather than showing zeros — the page
 * behind it becomes the real thing at that point.
 */
export function DropCountdown({
  publishAt,
  label = "Drops in",
}: {
  publishAt: string | null | undefined;
  label?: string;
}) {
  const [remaining, setRemaining] = useState<number | null>(() =>
    msUntilDrop(publishAt),
  );

  useEffect(() => {
    if (!publishAt) return;
    // Recomputed from the timestamp each tick, so a sleeping tab that wakes up
    // shows the truth instead of a drifted count.
    const id = setInterval(() => setRemaining(msUntilDrop(publishAt)), 1000);
    return () => clearInterval(id);
  }, [publishAt]);

  if (remaining === null) return null;

  return (
    <p className="flex items-baseline gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
      <span>{label}</span>
      <span
        aria-live="off"
        className="font-display text-base tracking-tight text-foreground tabular-nums"
      >
        {formatCountdown(remaining)}
      </span>
    </p>
  );
}
