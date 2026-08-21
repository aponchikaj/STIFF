"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ResolvedDrop } from "@/lib/api";

/**
 * The clock in the hero.
 *
 * Distinct from `DropCountdown`, which counts a single product down to its own
 * `publishAt`. This one is the whole drop: the site-wide schedule the admin
 * sets, with the four states that schedule can be in.
 *
 * The state — teaser, live, sold out, over — is the server's answer, resolved
 * against the server's clock, so every visitor sees the same drop regardless
 * of what their laptop thinks the time is. All this component does is subtract
 * two timestamps sixty times a minute and, when the number reaches zero, ask
 * the server what happens next.
 *
 * That last part matters: a countdown that hits 00:00:00 and then sits there
 * until someone reloads is worse than no countdown, and a client that decides
 * for itself that the drop is now open would let a wrong system clock into the
 * shop early.
 */

const SECOND = 1000;

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Never negative: a passed target reads as zero until the server catches up. */
function partsUntil(target: number, now: number): Parts {
  const left = Math.max(0, target - now);
  const total = Math.floor(left / SECOND);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function HeroDrop({ drop }: { drop: ResolvedDrop }) {
  if (drop.state === "off") return null;

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      {drop.state === "teaser" && drop.dropAt ? (
        <Teaser drop={drop} />
      ) : (
        <Status drop={drop} />
      )}
    </div>
  );
}

function Teaser({ drop }: { drop: ResolvedDrop }) {
  const router = useRouter();
  const target = new Date(drop.dropAt).getTime();

  /**
   * Seeded with the server's clock, not the browser's.
   *
   * The server rendered this markup at some earlier moment. If the first
   * client render used the real current time the two would disagree by however
   * long the request took, and React would report a hydration mismatch on the
   * seconds digit of every single page load. So the first paint reproduces
   * exactly what the server sent, and the interval takes over a tick later.
   *
   * The page is revalidated once a minute, so that seed can be up to a minute
   * stale and the first tick corrects it. On a clock measured in days that is
   * one frame nobody sees; the alternative is making the whole home page
   * uncacheable to keep a seconds digit honest.
   */
  const [now, setNow] = useState(() => new Date(drop.now).getTime());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), SECOND);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (now < target) return;
    // The clock ran out. The server owns what happens next.
    router.refresh();
  }, [now, target, router]);

  const parts = partsUntil(target, now);
  const label = drop.teaserLabel || "Next drop";

  return (
    <>
      <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted">
        {drop.name ? `${label} — ${drop.name}` : label}
      </p>
      {/* One live region for the whole clock rather than four, and polite
          rather than assertive — a screen reader announcing every second
          would make the page unusable. The `time` element carries the real
          moment for anything reading the page programmatically. */}
      <time
        dateTime={drop.dropAt}
        aria-live="off"
        className="flex items-end gap-3 sm:gap-5"
      >
        <Cell value={parts.days} unit="days" />
        <Cell value={parts.hours} unit="hrs" />
        <Cell value={parts.minutes} unit="min" />
        <Cell value={parts.seconds} unit="sec" />
      </time>
      <p className="sr-only">
        Opens {new Date(drop.dropAt).toLocaleString()}.
      </p>
    </>
  );
}

function Cell({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="font-display text-4xl leading-none tracking-tight tabular-nums sm:text-6xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.25em] text-muted">
        {unit}
      </span>
    </span>
  );
}

/** Live, sold out, or over — a label and, when it is done, a line under it. */
function Status({ drop }: { drop: ResolvedDrop }) {
  const done = drop.state === "sold_out" || drop.state === "ended";
  const label =
    drop.state === "live"
      ? drop.liveLabel || "Live now"
      : drop.state === "sold_out"
        ? drop.soldOutLabel || "Sold out"
        : drop.endedLabel || "That drop is over";

  return (
    <>
      <p
        className={`flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.25em] ${
          done ? "text-muted" : "text-foreground"
        }`}
      >
        {drop.state === "live" && (
          <span
            aria-hidden="true"
            className="size-2 animate-pulse rounded-full bg-foreground"
          />
        )}
        {drop.name ? `${drop.name} — ${label}` : label}
      </p>
      {done && drop.closedBody && (
        <p className="max-w-xs text-center text-xs leading-6 text-muted">
          {drop.closedBody}
        </p>
      )}
    </>
  );
}
