import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `cn`, taught this project's theme.
 *
 * This is **not** boilerplate and the extension is load-bearing. Stock
 * tailwind-merge only knows Tailwind's default scales, so it classifies
 * every unfamiliar `text-*` as a text colour. That means `text-title`
 * (a font size), `text-ink` (a colour) and `text-glow` (our text-shadow
 * utility) all land in the same conflict group, and merging keeps only the
 * last one. The symptom is silent and awful: headings render at inherited
 * 16px with no colour, and nothing errors.
 *
 * So the custom font sizes and colours are declared here, and the glow
 * utilities get a group of their own — a text-shadow does not conflict with
 * a colour and must survive alongside one.
 *
 * **Adding a colour or a size to `@theme` means adding it here too.**
 */
// The generic registers the class-group ids we are adding; without it the
// config's type only admits tailwind-merge's own built-in group names.
const twMerge = extendTailwindMerge<"text-glow" | "icon-glow" | "bloom">({
  extend: {
    theme: {
      // `--text-*` in globals.css
      text: ["hero", "title", "mega", "colossal", "body", "body-sm", "caption"],
      // `--color-*` in globals.css
      color: [
        "void",
        "bone",
        "blue",
        "cyan",
        "blue-deep",
        "blue-dim",
        "cyan-pale",
        "surface",
        "surface-2",
        "surface-3",
        "heart",
        "heart-dim",
        "coin",
        "coin-deep",
        "danger",
        "caution",
        "good",
        "ink",
        "ink-muted",
        "ink-faint",
      ],
    },
    classGroups: {
      // Text-shadow, not colour. Its own group so `text-ink text-glow`
      // keeps both rather than resolving to one.
      "text-glow": [
        "text-glow",
        "text-glow-blue",
        "text-glow-cyan",
        "text-glow-lg",
        "text-glow-heart",
        "text-glow-coin",
        "text-glow-xs",
        "text-glow-cyan-xs",
        "text-glow-coin-xs",
        "text-glow-heart-xs",
      ],
      // Drop-shadow filters on icons, same reasoning.
      "icon-glow": ["icon-glow", "icon-glow-lg", "icon-glow-heart", "icon-glow-coin"],
      bloom: [
        "bloom-none",
        "bloom-blue-sm",
        "bloom-blue",
        "bloom-blue-lg",
        "bloom-cyan",
        "bloom-cyan-lg",
        "bloom-danger",
        "bloom-coin",
      ],
    },
  },
});

/** Conditional classes, with later Tailwind utilities beating earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * `mm:ss` for a clock, `h:mm:ss` once it passes an hour.
 *
 * Zero-padded and monospaced-by-habit: a countdown whose width changes as
 * digits drop makes the whole HUD jitter. Clamped at zero because a clock
 * that has expired server-side can arrive as a negative number of seconds.
 */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/** `1,234`. Coins and Nerve are always grouped — four digits unbroken on a
 *  pixel face is unreadable at caption size. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** `1.2K` / `3.4M`, for a like count that must fit under an icon. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** "2m", "4h", "3d" — feed timestamps. Short because the card has no room. */
export function formatAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d`;
  return `${Math.floor(seconds / 604_800)}w`;
}

/** Seconds between now and an ISO timestamp, floored at zero. */
export function secondsUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.floor((target - Date.now()) / 1000));
}

/** `0.42` → `42%`, for a war's implied odds and an upload bar. */
export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** `12.4 MB`. Used by the hand-in screen to explain a rejected file. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Deterministic 0–1 from a string. For picking a stable decoration per
 *  handle without storing one — same player, same glitch offset, every load. */
export function hashFraction(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}
