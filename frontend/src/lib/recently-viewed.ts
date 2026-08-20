"use client";

/**
 * The last few pieces someone looked at, held in their own browser.
 *
 * Deliberately not on the server. It is a navigation aid, not a record: it
 * should work signed out, it should not follow anyone between devices, and it
 * is not worth a table or a row of tracking data per page view.
 */

const STORAGE_KEY = "stiff_recent";

/** Enough to find your way back, short enough to stay one row on a phone. */
const MAX = 8;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is string => typeof id === "string")
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function recentlyViewed(): string[] {
  return read();
}

/** Records a visit. Most recent first, no duplicates. */
export function rememberViewed(productId: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = [productId, ...read().filter((id) => id !== productId)].slice(
      0,
      MAX,
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full quota. A convenience strip is not worth throwing.
  }
}
