"use client";

import { useEffect } from "react";
import { btnOutline } from "@/components/ui";

/**
 * Catches a tab that throws while rendering.
 *
 * Without this the whole panel goes white, which reads as "the site is down"
 * rather than "the Orders tab has a bug" — and the difference matters when the
 * other eleven tabs are still perfectly usable.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin panel error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-start gap-4 py-20">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
        This section broke
      </p>
      <h2 className="text-3xl uppercase tracking-tight sm:text-4xl">
        Something went wrong
      </h2>
      <p className="max-w-prose text-xs leading-6 text-muted">
        The rest of the panel is fine — pick another section from the nav, or
        try this one again.
        {error.digest && (
          <>
            {" "}
            Reference <code className="font-mono">{error.digest}</code>.
          </>
        )}
      </p>
      <button type="button" onClick={reset} className={btnOutline}>
        Try again
      </button>
    </div>
  );
}
