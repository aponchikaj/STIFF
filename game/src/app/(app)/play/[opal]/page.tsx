"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { Suspense } from "react";
import { Haze } from "@/components/crt";
import { Icon } from "@/components/icon";
import { BackLink } from "@/components/nav";
import { Body, Button, Label, Screen } from "@/components/ui";
import type { SeasonDay } from "@/lib/api";
import { opalsAt, splitDuration } from "@/lib/opal-clock";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import {
  DemoTask,
  OpenOpal,
  usePlaySeason,
  Waiting,
} from "../shared";

/**
 * `/play/001` — inside an opal: its task.
 *
 * Reached by pressing the open opal on `/play`; the burst there cuts to the
 * flash here, so the two read as one movement. The task is dealt on arrival
 * (`TaskArea`'s auto-draw), then reads top to bottom: what it is, how it is
 * proved, the prize, ACCEPT or DECLINE.
 *
 * Only the open opal has a task. A locked or closed one, reached by a typed
 * URL or a stale tab, says so and points back — the server would refuse the
 * draw anyway, with the same words.
 */
export default function OpalTaskPage() {
  return (
    <Suspense fallback={<Waiting label="OPENING" />}>
      <OpalTaskScreen />
    </Suspense>
  );
}

const DAYS: Record<string, SeasonDay> = { "001": 1, "002": 2, "003": 3 };

function OpalTaskScreen() {
  const params = useParams<{ opal: string }>();
  const day = DAYS[params?.opal ?? ""] ?? null;
  const { season, now, dashboard, demo, loading } = usePlaySeason();
  const backHref = demo ? `/play?demo=${demo}` : "/play";

  if (loading) return <Waiting label="OPENING" />;

  // A season has three. Anything else is the 404 — the game's own one.
  if (day === null) notFound();

  const opal = opalsAt(season, now)[day - 1];

  if (opal.state !== "open") {
    return (
      <Away
        backHref={backHref}
        title={opal.state === "closed" ? `Opal ${opal.name} is closed` : `Opal ${opal.name} is locked`}
      >
        {opal.state === "closed"
          ? "Its tasks are gone and it will not open again."
          : "Its task is sealed inside until it opens."}
      </Away>
    );
  }

  const left = opal.closesAt !== null && now !== null ? opal.closesAt - now : null;

  return (
    <main className="relative overflow-hidden">
      <Haze intensity="md" />
      <Arrival />

      <Screen width="md" className="flex flex-col gap-6 pb-10 pt-2">
        <BackLink href={backHref}>Opals</BackLink>

        {/* the opal it came from, small, still lit */}
        <motion.header
          initial={{ opacity: 0, scale: 1.25 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-5"
        >
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-[-40%] -z-10"
              style={{
                background:
                  "radial-gradient(circle, rgb(1 231 255 / 0.35), transparent 65%)",
              }}
            />
            <div className="animate-float">
              <Icon name="opal" size="xl" glow="lg" priority />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{season?.title ?? "This season"}</Label>
            <span className="font-display text-[clamp(32px,9vw,48px)] leading-none text-ink text-glow pixel-snap scanlines-coarse">
              Opal {opal.name}
            </span>
            {left !== null ? (
              <span className="font-body text-caption uppercase tracking-[0.12em] text-ink-faint">
                Closes in {short(left)}
              </span>
            ) : null}
          </div>
        </motion.header>

        <div aria-hidden className="h-px w-full bg-blue-dim/60" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {demo ? <DemoTask day={day} /> : <OpenOpal day={day} dashboard={dashboard} />}
        </motion.div>
      </Screen>
    </main>
  );
}

/**
 * The tail of the burst on `/play`: a white-cyan flash that fills the screen
 * and drains away, so the cut between pages lands inside the light.
 * Purely decorative and gone in under a second; reduced motion skips it.
 */
function Arrival() {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40"
      style={{
        background:
          "radial-gradient(circle at 50% 30%, #ffffff 0%, #9ff5ff 25%, rgb(1 163 255 / 0.6) 55%, transparent 85%)",
      }}
      initial={{ opacity: 0.95 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.75, ease: "easeOut" }}
    />
  );
}

/** Not an open opal: say which, and go back. */
function Away({
  backHref,
  title,
  children,
}: {
  backHref: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Screen width="sm" className="flex min-h-[70dvh] flex-col justify-center gap-6 text-center">
      <div className="flex justify-center">
        <Icon name="opal" size="xl" dim />
      </div>
      <p className={cn("font-pixel text-[12px] uppercase tracking-[0.12em] text-ink-muted")}>
        {title}
      </p>
      <Body size="sm" className="mx-auto max-w-xs">
        {children}
      </Body>
      <div className="flex justify-center">
        <Link href={backHref}>
          <Button size="lg">Back to the opals</Button>
        </Link>
      </div>
    </Screen>
  );
}

/** "21h 59m", "43m 05s". */
function short(ms: number): string {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}
