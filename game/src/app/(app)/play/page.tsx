"use client";

import useEmblaCarousel from "embla-carousel-react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Haze } from "@/components/crt";
import { OpalArt, type OpalArtHandle } from "@/components/opal/opal-art";
import { Body, Button, Label } from "@/components/ui";
import type { Season } from "@/lib/api";
import {
  initialOpalIndex,
  markOpal,
  opalsAt,
  splitDuration,
  useOpalMark,
  type OpalView,
} from "@/lib/opal-clock";
import type { DemoMode } from "@/lib/opal-demo";
import {
  opalHref,
  usePlaySeason,
  Waiting,
  type DashboardQuery,
} from "./shared";
import { cn } from "@/lib/utils";

/**
 * `/play` — three opals, and nothing else.
 *
 * A season is 001, 002 and 003: one opal per day, swiped between. Each opens
 * 24 hours after the one before it and closes when the next one opens, on
 * the schedule the admin panel set (`season.opals`, from the server).
 *
 *   locked  chained, padlocked, counting down to its hour
 *   open    the chains break on the second; pressing the stone bursts it
 *           open and goes through to `/play/001` (`[opal]/page.tsx`),
 *           where the task is dealt
 *   closed  chained again, for good — pressing it only rattles the chain
 *
 * The flip is computed here, from the windows and the server's clock, so
 * 001 unlocks at 00:00 on a screen nobody has touched. The server agrees:
 * a draw for anything but the open opal is refused there too.
 */
export default function PlayPage() {
  // `useSearchParams` needs a boundary, or the whole route renders client-only.
  return (
    <Suspense fallback={<Waiting />}>
      <PlayScreen />
    </Suspense>
  );
}

function PlayScreen() {
  const { season, now, dashboard, demo, loading } = usePlaySeason();
  if (loading) return <Waiting />;
  return <Opals season={season} now={now} dashboard={dashboard} demo={demo} />;
}

/* ============================================================== the row */

function Opals({
  season,
  now,
  dashboard,
  demo,
}: {
  season: Season | null;
  now: number | null;
  dashboard: DashboardQuery;
  demo: DemoMode | null;
}) {
  const opals = opalsAt(season, now);
  const startIndex = initialOpalIndex(opals);

  const [emblaRef, embla] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    startIndex,
    skipSnaps: false,
  });
  const [selected, setSelected] = useState(startIndex);

  useEffect(() => {
    if (!embla) return;
    // `reInit` too: the start index changes when the season arrives after
    // the first paint, and Embla re-initialises there without a `select`.
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSelect).on("reInit", onSelect);
    return () => {
      embla.off("select", onSelect).off("reInit", onSelect);
    };
  }, [embla]);

  // When an opal opens while the screen is up, take the player to it — the
  // event happens where they are looking.
  const openDay = opals.find((o) => o.state === "open")?.day ?? null;
  const lastOpen = useRef(openDay);
  useEffect(() => {
    if (openDay !== null && lastOpen.current !== openDay && embla) {
      embla.scrollTo(openDay - 1);
    }
    lastOpen.current = openDay;
  }, [openDay, embla]);

  // Keep the season fresh across a flip: its status moves to `running` on
  // the server within the minute, and the dashboard's counts reset by day.
  const { refetch } = dashboard;
  const stateKey = opals.map((o) => o.state).join(",");
  const firstKey = useRef(stateKey);
  useEffect(() => {
    if (firstKey.current === stateKey) return;
    firstKey.current = stateKey;
    void refetch();
  }, [stateKey, refetch]);

  const current = opals[selected] ?? opals[0];

  return (
    <main className="relative flex min-h-[calc(100dvh-7rem)] flex-col overflow-hidden">
      <Haze intensity="md" />

      {/* which opal of three — tap to jump */}
      <nav
        aria-label="Opals"
        className="flex items-center justify-center gap-6 pt-6 sm:pt-8"
      >
        {opals.map((opal, index) => (
          <button
            key={opal.day}
            type="button"
            onClick={() => embla?.scrollTo(index)}
            aria-current={index === selected ? "true" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 px-1 font-pixel text-[10px] uppercase tracking-[0.14em] transition-all duration-200",
              index === selected
                ? "text-ink text-glow-cyan-xs"
                : "text-ink-faint hover:text-ink-muted",
            )}
          >
            <StateDot state={opal.state} />
            {opal.name}
          </button>
        ))}
      </nav>

      {/* the carousel */}
      <div className="relative mt-2">
        <div ref={emblaRef} className="overflow-hidden" aria-roledescription="carousel">
          <div className="flex touch-pan-y">
            {opals.map((opal, index) => (
              <div
                key={opal.day}
                className="min-w-0 flex-[0_0_72%] sm:flex-[0_0_46%] lg:flex-[0_0_34%]"
                aria-roledescription="slide"
                aria-label={`Opal ${opal.name} of 3`}
              >
                <OpalSlide
                  opal={opal}
                  season={season}
                  now={now}
                  active={index === selected}
                  demo={demo}
                  onFocusSlide={() => embla?.scrollTo(index)}
                />
              </div>
            ))}
          </div>
        </div>

        <Arrow
          side="left"
          disabled={selected === 0}
          onClick={() => embla?.scrollPrev()}
        />
        <Arrow
          side="right"
          disabled={selected === opals.length - 1}
          onClick={() => embla?.scrollNext()}
        />
      </div>

      {/* what the selected opal holds */}
      <div className="mx-auto w-full max-w-2xl px-4 pb-6 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.day}:${current.state}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <Underneath opal={current} season={season} now={now} demo={demo} />
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

/* ============================================================ one opal */

function OpalSlide({
  opal,
  season,
  now,
  active,
  demo,
  onFocusSlide,
}: {
  opal: OpalView;
  season: Season | null;
  now: number | null;
  active: boolean;
  demo: DemoMode | null;
  onFocusSlide: () => void;
}) {
  const router = useRouter();
  const art = useRef<OpalArtHandle>(null);
  const seasonId = season?.id;
  const unsealed = useOpalMark(seasonId, opal.day, "unsealed");
  const opened = useOpalMark(seasonId, opal.day, "opened");

  // A ceremony in progress owns the opal: no second one starts over it.
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState(0);
  const [shout, setShout] = useState(false);
  const shoutTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(shoutTimer.current), []);

  /**
   * The opal's hour: the chains break on their own, the moment the player
   * is looking at it — at 00:00, or on the first visit after. The stone is
   * then lit but shut, and waits for a press.
   */
  const unseal = useCallback(async () => {
    if (!seasonId || !art.current) return;
    setBusy(true);
    try {
      await settle(art.current.unseal());
      markOpal(seasonId, opal.day, "unsealed");
    } finally {
      setBusy(false);
    }
  }, [seasonId, opal.day]);

  const due = active && opal.state === "open" && !unsealed && !busy;
  useEffect(() => {
    if (!due) return;
    // A beat first, so the slide has settled and the eye is on it.
    const id = window.setTimeout(() => void unseal(), 450);
    return () => window.clearTimeout(id);
  }, [due, unseal]);

  /**
   * The press: the stone bursts open, and the burst carries the player
   * through to the opal's own page, where the task is dealt. `opened` is
   * remembered, so coming back shows the stone already open.
   */
  const href = opalHref(opal.day, demo);
  useEffect(() => {
    // Warm the task page while the stone waits, so the cut after the burst
    // lands on a page that is already there.
    if (active && opal.state === "open") router.prefetch(href);
  }, [active, opal.state, href, router]);

  async function open() {
    if (!seasonId || !art.current) return;
    setBusy(true);
    try {
      if (!unsealed) {
        await settle(art.current.unseal());
        markOpal(seasonId, opal.day, "unsealed");
      }
      if (art.current) await settle(art.current.open());
      markOpal(seasonId, opal.day, "opened");
      router.push(href);
    } finally {
      setBusy(false);
    }
  }

  // Embla swallows the click that ends a drag, so a press here is a tap.
  async function press() {
    if (!active) {
      onFocusSlide();
      return;
    }
    if (busy || !art.current) return;
    if (opal.state === "open") {
      if (opened) router.push(href);
      else void open();
      return;
    }
    // Locked or closed: it fights you and does not open.
    setRefusal((n) => n + 1);
    setShout(true);
    window.clearTimeout(shoutTimer.current);
    shoutTimer.current = window.setTimeout(() => setShout(false), 1600);
    setBusy(true);
    try {
      await settle(art.current.rattle());
    } finally {
      setBusy(false);
    }
  }

  const label =
    opal.state === "open"
      ? `Opal ${opal.name}, open`
      : opal.state === "closed"
        ? `Opal ${opal.name}, closed`
        : `Opal ${opal.name}, locked`;

  return (
    <motion.div
      animate={{ scale: active ? 1 : 0.72, opacity: active ? 1 : 0.38 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-3 pb-2 pt-4"
    >
      <button
        type="button"
        onClick={press}
        aria-label={label}
        className="relative block aspect-[200/220] w-[min(64vw,320px)] cursor-pointer select-none outline-offset-8"
      >
        <OpalArt
          ref={art}
          state={opal.state}
          unsealed={opal.state === "open" && unsealed}
          opened={opened}
          inviting={active && opal.state === "open" && unsealed && !opened && !busy}
          className="size-full"
        />
      </button>

      {/* the name, big */}
      <span
        className={cn(
          "font-display text-[clamp(44px,12vw,72px)] leading-none pixel-snap scanlines-coarse",
          opal.state === "open"
            ? "text-ink text-glow"
            : opal.state === "closed"
              ? "text-ink-faint"
              : "text-ink-muted",
        )}
      >
        {opal.name}
      </span>

      <StatusLine opal={opal} now={now} refusal={refusal} shout={shout} active={active} />
    </motion.div>
  );
}

/**
 * The line under the number: state, and the time that matters for it.
 * A refused press shakes it and says why, then it settles back.
 */
function StatusLine({
  opal,
  now,
  refusal,
  shout,
  active,
}: {
  opal: OpalView;
  now: number | null;
  refusal: number;
  shout: boolean;
  /** The big countdown underneath already says it; do not say it twice. */
  active: boolean;
}) {
  const tone =
    opal.state === "open"
      ? "text-cyan text-glow-cyan-xs"
      : opal.state === "closed"
        ? "text-heart text-glow-heart-xs"
        : "text-blue";

  const word =
    opal.state === "open" ? "Open" : opal.state === "closed" ? "Closed" : "Locked";

  return (
    <motion.div
      key={refusal}
      animate={refusal ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
      transition={{ duration: 0.4 }}
      className="flex min-h-10 flex-col items-center gap-1.5"
    >
      <span
        className={cn(
          "flex items-center gap-2 font-pixel text-[10px] uppercase tracking-[0.18em]",
          tone,
        )}
      >
        <StateDot state={opal.state} />
        {shout
          ? opal.state === "closed"
            ? "Closed for good"
            : "Not yet"
          : word}
      </span>
      {opal.state === "locked" && opal.opensAt !== null && now !== null && !active ? (
        <span className="font-body text-caption uppercase tracking-[0.12em] text-ink-faint">
          Opens in {short(opal.opensAt - now)}
        </span>
      ) : opal.state === "open" && opal.closesAt !== null && now !== null ? (
        <span className="font-body text-caption uppercase tracking-[0.12em] text-ink-faint">
          Closes in {short(opal.closesAt - now)}
        </span>
      ) : opal.state === "locked" && opal.opensAt === null ? (
        <span className="font-body text-caption uppercase tracking-[0.12em] text-ink-faint">
          Date to come
        </span>
      ) : null}
    </motion.div>
  );
}

/* ======================================================== underneath */

/** What the selected opal says underneath: a countdown, an invitation, or a full stop. */
function Underneath({
  opal,
  season,
  now,
  demo,
}: {
  opal: OpalView;
  season: Season | null;
  now: number | null;
  demo: DemoMode | null;
}) {
  const opened = useOpalMark(season?.id, opal.day, "opened");

  if (opal.state === "locked") {
    return <LockedNote opal={opal} season={season} now={now} />;
  }

  if (opal.state === "closed") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Body size="sm" className="max-w-xs">
          Opal {opal.name} is sealed. Its tasks are gone and it will not open
          again.
        </Body>
      </div>
    );
  }

  // Open, but not opened on this device: the stone is the event, and the
  // only thing under it is the instruction.
  if (!opened) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <motion.span
          aria-hidden
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className="font-pixel text-[12px] text-cyan text-glow-cyan"
        >
          ▲
        </motion.span>
        <span className="animate-[blink_1.1s_steps(2,end)_infinite] font-pixel text-[12px] uppercase tracking-[0.16em] text-cyan text-glow-cyan">
          Tap the opal to open it
        </span>
        <span className="font-body text-caption uppercase tracking-[0.12em] text-ink-faint">
          Your task is inside
        </span>
      </div>
    );
  }

  // Opened before: the task lives on the opal's own page.
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <Link href={opalHref(opal.day, demo)}>
        <Button size="lg">Go to your task</Button>
      </Link>
      <span className="font-body text-caption uppercase tracking-[0.12em] text-ink-faint">
        Or tap the opal
      </span>
    </div>
  );
}

/**
 * Before an opal's hour. For the first of the season this is the big
 * countdown — the whole screen is waiting for it; for the others it says
 * which opal must close first.
 */
function LockedNote({
  opal,
  season,
  now,
}: {
  opal: OpalView;
  season: Season | null;
  now: number | null;
}) {
  if (opal.opensAt === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Body size="sm" className="max-w-xs">
          {season
            ? "The date is not set yet. When it is, the countdown starts here."
            : "No season yet. When one is announced, 001 counts down here."}
        </Body>
      </div>
    );
  }

  const first = opal.day === 1;

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <Label tone="faint">{first ? "The game starts in" : `Opal ${opal.name} opens in`}</Label>
      <Countdown target={opal.opensAt} now={now} />
      <Label tone="faint">{formatWhen(opal.opensAt)}</Label>
      {!first ? (
        <Body size="sm" className="max-w-xs pt-1">
          It opens when opal {String(opal.day - 1).padStart(3, "0")} closes — 24
          hours after it opened.
        </Body>
      ) : null}
    </div>
  );
}

/* ============================================================ countdown */

/** DD : HH : MM : SS, each pair a block, ticking on the server's second. */
function Countdown({ target, now }: { target: number; now: number | null }) {
  const parts = now === null ? null : splitDuration(target - now);
  const cells: [string, number | null][] = [
    ["Days", parts?.days ?? null],
    ["Hrs", parts?.hours ?? null],
    ["Min", parts?.minutes ?? null],
    ["Sec", parts?.seconds ?? null],
  ];

  return (
    <div
      className="flex items-start gap-2 sm:gap-3"
      role="timer"
      aria-live="off"
      aria-label={
        parts
          ? `${parts.days} days ${parts.hours} hours ${parts.minutes} minutes ${parts.seconds} seconds`
          : "Counting down"
      }
    >
      {cells.map(([unit, value], index) => (
        <div key={unit} className="flex items-start gap-2 sm:gap-3">
          {index > 0 ? (
            <span className="animate-[blink_1s_steps(2,end)_infinite] pt-2 font-pixel text-[clamp(18px,5vw,28px)] leading-none text-blue text-glow-blue">
              :
            </span>
          ) : null}
          <div className="flex flex-col items-center gap-2">
            <span className="min-w-[2ch] font-pixel text-[clamp(26px,8vw,44px)] leading-none tabular-nums text-cyan text-glow-lg">
              {value === null ? "--" : String(value).padStart(2, "0")}
            </span>
            <span className="font-body text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              {unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================ bits */

function StateDot({ state }: { state: OpalView["state"] }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-1.5",
        state === "open"
          ? "animate-pulse bg-cyan shadow-[var(--glow-cyan-sm)]"
          : state === "closed"
            ? "bg-heart shadow-[var(--glow-heart)]"
            : "bg-blue-dim",
      )}
    />
  );
}

function Arrow({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous opal" : "Next opal"}
      className={cn(
        "absolute top-[38%] z-10 flex size-11 -translate-y-1/2 items-center justify-center font-pixel text-[14px] text-blue text-glow-blue transition-all duration-200 hover:text-cyan hover:text-glow-cyan disabled:pointer-events-none disabled:opacity-0",
        side === "left" ? "left-1 sm:left-6" : "right-1 sm:right-6",
      )}
    >
      {side === "left" ? "◀" : "▶"}
    </button>
  );
}

/**
 * A ceremony, or four seconds — whichever ends first.
 *
 * An animation that is interrupted (a hot reload, a tab put away mid-burst)
 * can leave its promise unsettled. The outcome — "this opal is open" —
 * must not wait on a tween, so every ceremony is raced against a ceiling.
 */
function settle(ceremony: Promise<void>): Promise<void> {
  return Promise.race([
    ceremony.catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, 4000)),
  ]);
}

/** "5h 12m", "3d 4h", "43s" — the short form under an opal. */
function short(ms: number): string {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/** "Thu 30 Oct · 00:00", in the reader's own time zone. */
function formatWhen(at: number): string {
  const d = new Date(at);
  const date = d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} · ${time}`;
}
