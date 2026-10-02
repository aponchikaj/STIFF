/**
 * Development only: a made-up season for `/play?demo=<mode>`.
 *
 * Every local run talks to the shared hosted database, whose season is
 * whatever it is — usually long finished. Rescheduling a real season to
 * watch 001 unlock would move it for everyone, so the screen can instead be
 * handed a schedule built in the browser. Nothing is written anywhere, and
 * the task panel shows a stand-in rather than drawing against a server that
 * disagrees about which opal is open.
 *
 *   countdown  001 opens 12 seconds after the page loads — the full ceremony
 *   open       001 open now
 *   day2       001 closed, 002 open
 *   day3       001 and 002 closed, 003 open
 *   ended      all three closed
 *   tba        a season with no date yet
 */

import type { Season } from "@/lib/api";

export const DEMO_MODES = ["countdown", "open", "day2", "day3", "ended", "tba"] as const;
export type DemoMode = (typeof DEMO_MODES)[number];

const HOUR = 3_600_000;

export function isDemoMode(value: string | null): value is DemoMode {
  return (
    process.env.NODE_ENV !== "production" &&
    value !== null &&
    (DEMO_MODES as readonly string[]).includes(value)
  );
}

export function demoSeason(mode: DemoMode, loadedAt: number): Season {
  const start =
    mode === "countdown"
      ? loadedAt + 12_000
      : mode === "open"
        ? loadedAt - 2 * HOUR
        : mode === "day2"
          ? loadedAt - 26 * HOUR
          : mode === "day3"
            ? loadedAt - 50 * HOUR
            : loadedAt - 80 * HOUR;

  const opals =
    mode === "tba"
      ? []
      : ([1, 2, 3] as const).map((day) => {
          const opensAt = start + (day - 1) * 24 * HOUR;
          const closesAt = opensAt + 24 * HOUR;
          return {
            day,
            opensAt: new Date(opensAt).toISOString(),
            closesAt: new Date(closesAt).toISOString(),
            state:
              loadedAt < opensAt
                ? ("locked" as const)
                : loadedAt < closesAt
                  ? ("open" as const)
                  : ("closed" as const),
          };
        });

  return {
    // A fresh id per load, so the device's "already watched it" memory never
    // swallows the ceremony being demonstrated.
    id: `demo-${mode}-${loadedAt}`,
    slug: "demo",
    title: "Demo season",
    status: mode === "countdown" || mode === "tba" ? "open" : "running",
    startsAt: mode === "tba" ? null : new Date(start).toISOString(),
    endsAt: null,
    now: new Date(loadedAt).toISOString(),
    opals,
  };
}
