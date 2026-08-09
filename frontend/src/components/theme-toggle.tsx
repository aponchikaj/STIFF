"use client";

import { AsteriskMark } from "./asterisk-mark";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const dark = root.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // private mode — theme still applies for this page view
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light and dark mode"
      className="spin-on-hover flex size-10 items-center justify-center rounded-sm text-foreground transition-colors hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
    >
      <AsteriskMark className="size-4" />
    </button>
  );
}
