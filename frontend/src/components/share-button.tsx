"use client";

import { useState } from "react";
import type { ShareSubject } from "@/lib/share-image";
import { ShareSheet } from "./share-sheet";

/**
 * Opens the branded share sheet. `variant="icon"` is the compact form used on
 * grid tiles, where it sits above the tile's link rather than inside it —
 * nesting a button in an anchor is invalid and breaks keyboard navigation.
 */
export function ShareButton({
  subject,
  variant = "button",
  className = "",
}: {
  subject: ShareSubject;
  variant?: "button" | "icon";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const base =
    "rounded-[2px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted";

  return (
    <>
      {open && (
        <ShareSheet subject={subject} onClose={() => setOpen(false)} />
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Share ${subject.title}`}
        className={
          variant === "icon"
            ? `${base} flex size-8 items-center justify-center bg-background text-sm text-foreground hover:bg-surface ${className}`
            : `${base} flex h-9 items-center gap-2 border border-subtle px-4 text-[11px] font-medium uppercase tracking-[0.15em] text-muted hover:border-foreground hover:text-foreground ${className}`
        }
      >
        <ShareGlyph />
        {variant === "button" && <span>Share</span>}
      </button>
    </>
  );
}

function ShareGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}
