"use client";

/**
 * What `/play` and `/play/[opal]` share: one reading of the season, and the
 * task gate.
 *
 * Both pages must agree to the second on which opal is open, so both read
 * the season the same way — the dashboard's copy when signed in, the public
 * one otherwise, offset to the server's clock, or the development demo.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { TaskArea, TaskOffer } from "@/components/play-task";
import { Button, Loading } from "@/components/ui";
import { ApiError, type Season, type SeasonDay } from "@/lib/api";
import { useServerNow } from "@/lib/opal-clock";
import { demoSeason, isDemoMode, type DemoMode } from "@/lib/opal-demo";
import { useDashboard, useSeason } from "@/lib/queries";

export type DashboardQuery = ReturnType<typeof useDashboard>;

export interface PlaySeason {
  season: Season | null;
  /** Server-clock milliseconds, ticking; null before hydration. */
  now: number | null;
  dashboard: DashboardQuery;
  demo: DemoMode | null;
  loading: boolean;
}

/** Needs a `<Suspense>` above it: it reads the search params. */
export function usePlaySeason(): PlaySeason {
  const seasonQuery = useSeason();
  const dashboard = useDashboard();

  // Development only — see `opal-demo.ts`. Null in a production build.
  const demoParam = useSearchParams().get("demo");
  const demo = isDemoMode(demoParam) ? demoParam : null;
  const [loadedAt] = useState(() => Date.now());
  const fake = demo ? demoSeason(demo, loadedAt) : null;

  // The dashboard carries the same season with the same schedule; prefer it
  // when signed in, so the two never disagree on screen.
  const season: Season | null =
    fake ?? dashboard.data?.season ?? seasonQuery.data ?? null;
  const receivedAt = fake
    ? loadedAt
    : dashboard.data?.season
      ? dashboard.dataUpdatedAt
      : seasonQuery.dataUpdatedAt;
  const now = useServerNow(season?.now, receivedAt);

  return {
    season,
    now,
    dashboard,
    demo,
    loading: !fake && seasonQuery.isLoading && dashboard.isLoading,
  };
}

/** `1` → `001`. */
export function opalName(day: SeasonDay): string {
  return String(day).padStart(3, "0");
}

/**
 * The task page for an opal. The demo rides along — as `open`, since a
 * `countdown` demo rebuilt on the next page would start counting again.
 */
export function opalHref(day: SeasonDay, demo: DemoMode | null): string {
  const base = `/play/${opalName(day)}`;
  if (!demo) return base;
  return `${base}?demo=${demo === "countdown" ? "open" : demo}`;
}

export function Waiting({ label = "FINDING THE OPALS" }: { label?: string }) {
  return (
    <main className="flex min-h-[70dvh] items-center justify-center">
      <Loading label={label} />
    </main>
  );
}

/** Demo mode's stand-in: the real offer card, with a sample task. */
export function DemoTask({ day }: { day: SeasonDay }) {
  return (
    <TaskOffer
      assignment={{
        id: "demo",
        status: "offered",
        clanId: null,
        day,
        clockMinutes: 15,
        acceptedAt: null,
        expiresAt: null,
        secondsLeft: null,
        heartBurned: false,
        attemptId: null,
        task: {
          id: "demo",
          slug: "demo-compliment-a-plant",
          tier: day,
          title: "Compliment a plant",
          brief: "Give a houseplant three sincere compliments on camera.",
          proof: "video",
          mode: "solo",
          rewardNerve: 10,
          rewardCoins: 2,
          penaltyCoins: 1,
          clockMinutes: 15,
          guards: ["No one else's plant without asking"],
          criteria: [
            { id: "c1", assert: "Three compliments are spoken", modality: "audio", required: true },
            { id: "c2", assert: "A plant is in frame", modality: "visual", required: true },
          ],
        },
      }}
      heartsRemaining={3}
      accepting={false}
      onAccept={() => undefined}
      onDecline={() => undefined}
    />
  );
}

/** The open opal, for whoever is looking: a player gets the task. */
export function OpenOpal({ day, dashboard }: { day: SeasonDay; dashboard: DashboardQuery }) {
  const signedOut =
    dashboard.error instanceof ApiError && dashboard.error.isUnauthorized;

  if (dashboard.isLoading) return <Loading label="READING YOUR TASK" />;

  if (signedOut || !dashboard.data) {
    return (
      <Gate title="Sign in to take its task">
        <Link href="/login">
          <Button size="lg">Sign in</Button>
        </Link>
        <Link href="/join">
          <Button variant="quiet">Join the game</Button>
        </Link>
      </Gate>
    );
  }

  const { enrolment, season, today } = dashboard.data;

  if (!enrolment) {
    return (
      <Gate title="Pick a side to play">
        <Link href="/join">
          <Button size="lg">Pick a side</Button>
        </Link>
      </Gate>
    );
  }

  if (enrolment.role === "watcher") {
    return (
      <Gate title="Watchers vote">
        <Link href="/vote">
          <Button size="lg">Vote</Button>
        </Link>
        <Link href="/feed">
          <Button variant="quiet">Feed</Button>
        </Link>
      </Gate>
    );
  }

  // A closed season, or none: nothing deals. An `open` one whose 001 is
  // open on this screen is fine — the draw starts it on the server.
  if (season?.status !== "running" && season?.status !== "open") {
    return (
      <Gate title="The season is over">
        <Link href="/board">
          <Button variant="quiet">See the board</Button>
        </Link>
      </Gate>
    );
  }

  return (
    <TaskArea
      key={day}
      day={day}
      heartsRemaining={enrolment.heartsRemaining}
      today={today}
      autoDraw
    />
  );
}

export function Gate({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <span className="font-pixel text-[11px] uppercase tracking-[0.14em] text-ink-muted">
        {title}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-6">{children}</div>
    </div>
  );
}

