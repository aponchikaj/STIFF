"use client";

/**
 * Time and memory for the opals.
 *
 * **One ticker.** Every countdown on the screen reads the same once-a-second
 * store, so three opals and a task clock never drift apart by a frame, and
 * there is one interval rather than one per component. The server render has
 * no clock (`null`), so a countdown renders a placeholder until hydration
 * instead of a time that would mismatch.
 *
 * **Server time, not phone time.** The season payload carries the server's
 * `now`; the offset between that and the moment it arrived is applied to
 * every reading, so a phone set five minutes fast still unlocks 001 on the
 * right second — and agrees with what a draw will be told.
 *
 * **Device memory.** Whether this device has already watched an opal's
 * chains break, and already opened it, is remembered per season and opal —
 * the ceremony plays once, not on every visit.
 */

import { useSyncExternalStore } from "react";
import type { OpalState, OpalWindowView, Season, SeasonDay } from "@/lib/api";

/* ---------------------------------------------------------------- ticker */

let tick = 0;
let timer: number | undefined;
const listeners = new Set<() => void>();

function subscribeTick(onChange: () => void): () => void {
  listeners.add(onChange);
  if (timer === undefined) {
    tick = Date.now();
    timer = window.setInterval(() => {
      tick = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  // A backgrounded tab throttles timers hard; catch up the moment it shows.
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      tick = Date.now();
      onChange();
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    listeners.delete(onChange);
    document.removeEventListener("visibilitychange", onVisible);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * Milliseconds since the epoch on the *server's* clock, re-read every
 * second. Null during the server render.
 */
export function useServerNow(
  serverNow: string | undefined,
  receivedAt: number,
): number | null {
  const local = useSyncExternalStore(
    subscribeTick,
    () => tick || Date.now(),
    () => 0,
  );
  if (!local) return null;
  const parsed = serverNow ? Date.parse(serverNow) : NaN;
  const offset =
    Number.isNaN(parsed) || !receivedAt ? 0 : parsed - receivedAt;
  return local + offset;
}

/* ---------------------------------------------------------------- opals */

export interface OpalView {
  day: SeasonDay;
  /** "001". */
  name: string;
  state: OpalState;
  opensAt: number | null;
  closesAt: number | null;
}

const NAMES: Record<SeasonDay, string> = { 1: "001", 2: "002", 3: "003" };

/**
 * The three opals at `now`, recomputed from their windows rather than taken
 * from the state the server sent — the server's state is a snapshot, and the
 * screen must flip 001 to open at 00:00 without a refetch. With no schedule
 * (no start announced) all three are locked with no times.
 */
export function opalsAt(season: Season | null | undefined, now: number | null): OpalView[] {
  const windows: OpalWindowView[] = season?.opals ?? [];
  return ([1, 2, 3] as SeasonDay[]).map((day) => {
    const w = windows.find((x) => x.day === day);
    if (!w) {
      return { day, name: NAMES[day], state: "locked", opensAt: null, closesAt: null };
    }
    const opensAt = Date.parse(w.opensAt);
    const closesAt = Date.parse(w.closesAt);
    const state: OpalState =
      now === null
        ? w.state
        : now < opensAt
          ? "locked"
          : now < closesAt
            ? "open"
            : "closed";
    return { day, name: NAMES[day], state, opensAt, closesAt };
  });
}

/** Which opal the carousel starts on: the open one, else the next, else 003. */
export function initialOpalIndex(opals: OpalView[]): number {
  const open = opals.findIndex((o) => o.state === "open");
  if (open >= 0) return open;
  const next = opals.findIndex((o) => o.state === "locked");
  return next >= 0 ? next : opals.length - 1;
}

/** `d`, `hh`, `mm`, `ss` until `target`, never negative. */
export function splitDuration(ms: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/* --------------------------------------------------------------- memory */

type Mark = "unsealed" | "opened";

const memoryListeners = new Set<() => void>();

function key(seasonId: string, day: SeasonDay, mark: Mark): string {
  return `stiff:opal:${seasonId}:${day}:${mark}`;
}

function read(seasonId: string | undefined, day: SeasonDay, mark: Mark): boolean {
  if (!seasonId) return false;
  try {
    return window.localStorage.getItem(key(seasonId, day, mark)) === "1";
  } catch {
    // Private mode, blocked storage: the ceremony just plays again.
    return false;
  }
}

/** Remembers that this device has seen an opal unseal, or opened it. */
export function markOpal(seasonId: string, day: SeasonDay, mark: Mark): void {
  try {
    window.localStorage.setItem(key(seasonId, day, mark), "1");
  } catch {
    /* see read() */
  }
  memoryListeners.forEach((l) => l());
}

function subscribeMemory(onChange: () => void): () => void {
  memoryListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    memoryListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Whether this device remembers `mark` for an opal. False on the server. */
export function useOpalMark(
  seasonId: string | undefined,
  day: SeasonDay,
  mark: Mark,
): boolean {
  return useSyncExternalStore(
    subscribeMemory,
    () => read(seasonId, day, mark),
    () => false,
  );
}
