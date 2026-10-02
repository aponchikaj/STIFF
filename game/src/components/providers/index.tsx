"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "./query-provider";
import { SmoothScroll } from "./smooth-scroll";

/** Everything the tree needs, in the order it needs it. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <SmoothScroll />
      {children}
      <Toaster
        position="top-center"
        // The toast is part of the arcade, not a system notification: square
        // corners, pixel type, cyan on black. Styling lives here rather than
        // in each `toast()` call so a new one cannot land looking generic.
        toastOptions={{
          className:
            "!bg-void !text-ink !border !border-blue !rounded-none !font-pixel !text-[10px] !leading-4 !uppercase !tracking-[0.08em] glow-blue-sm",
          duration: 4000,
        }}
      />
    </QueryProvider>
  );
}
