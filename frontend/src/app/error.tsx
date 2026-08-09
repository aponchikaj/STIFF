"use client";

import { AsteriskMark } from "@/components/asterisk-mark";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <AsteriskMark className="size-14 text-muted sm:size-20" />
      <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
        Something broke
      </h1>
      <p className="text-sm text-muted">
        Not the look we were going for. Try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 flex h-11 items-center rounded-[2px] bg-foreground px-6 text-xs font-bold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Retry
      </button>
    </section>
  );
}
