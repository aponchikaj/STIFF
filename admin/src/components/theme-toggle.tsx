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
      className="spin-on-hover inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] border border-line text-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      <AsteriskMark className="size-[15px]" />
    </button>
  );
}
