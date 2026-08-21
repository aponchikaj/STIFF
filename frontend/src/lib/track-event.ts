import { apiFetch } from "@/lib/api";

/**
 * Named moments, batched.
 *
 * Scrolling a long page fires several of these within a couple of seconds, and
 * a request per section would be a request per section. Everything queued
 * inside the flush window goes in one POST, and the queue is drained on the
 * way out of the page so the last section anybody reached is not the one
 * that never gets reported.
 *
 * Analytics must never break a page: every failure here is swallowed.
 */

export type TrackableEvent =
  | "section_view"
  | "intro_shown"
  | "intro_skipped";

interface Queued {
  name: TrackableEvent;
  label?: string;
}

/** Long enough to collect a scroll burst, short enough to survive a tab close. */
const FLUSH_MS = 1500;

let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

/**
 * The same id `TrackPageview` uses, so an event joins its own page view.
 *
 * Returns null when storage is blocked, and that visit simply goes uncounted
 * rather than being counted as a new visitor on every event.
 */
function visitorId(): string | null {
  try {
    let id = localStorage.getItem("stiff_vid");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("stiff_vid", id);
    }
    return id;
  } catch {
    return null;
  }
}

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const events = queue;
  queue = [];
  if (events.length === 0) return;

  const id = visitorId();
  if (!id) return;

  void apiFetch("/track/events", {
    method: "POST",
    body: { path: window.location.pathname, visitorId: id, events },
  }).catch(() => {
    // Dropped on purpose. A retry queue for scroll depth is not worth the
    // memory it would sit in.
  });
}

export function trackEvent(name: TrackableEvent, label?: string) {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path.startsWith("/admin") || path.startsWith("/c/")) return;

  queue.push(label ? { name, label } : { name });

  if (!listening) {
    listening = true;
    // `visibilitychange` rather than `beforeunload`: mobile browsers often
    // never fire the latter, which is exactly where a half-read page is most
    // likely to be abandoned.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}
