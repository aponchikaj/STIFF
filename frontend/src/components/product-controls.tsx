"use client";

import { useState } from "react";
import { Magnetic } from "./motion";

export function ProductControls({ sizes }: { sizes: string[] }) {
  const [size, setSize] = useState<string | null>(
    sizes.length === 1 ? sizes[0] : null,
  );
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mt-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
        Size
      </p>
      <div
        role="radiogroup"
        aria-label="Size"
        className="mt-3 flex flex-wrap gap-2"
      >
        {sizes.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={size === s}
            onClick={() => setSize(s)}
            className={`flex h-11 min-w-11 items-center justify-center rounded-[2px] border px-4 text-xs font-medium uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
              size === s
                ? "border-foreground bg-foreground text-background"
                : "border-subtle text-muted hover:border-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <Magnetic className="mt-8 inline-block">
        <button
          type="button"
          onClick={() =>
            setMessage(
              size
                ? "The cart is coming soon — this is a design preview."
                : "Pick a size first.",
            )
          }
          className="flex h-12 items-center rounded-[2px] bg-foreground px-8 text-xs font-bold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Add to cart
        </button>
      </Magnetic>
      <p aria-live="polite" className="mt-4 min-h-5 text-xs text-muted">
        {message}
      </p>
    </div>
  );
}
