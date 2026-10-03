"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import {
  Display,
  Empty,
  Label,
  Loading,
  Rule,
  Screen,
} from "@/components/ui";
import type { WarFilter, WarStatus, WarView } from "@/lib/api";
import { useWars } from "@/lib/queries";
import { cn, formatNumber, secondsUntil } from "@/lib/utils";
import { formatClock } from "@/lib/utils";

/**
 * `/wars` — clan against clan, with a coin book on the side.
 *
 * Public to read, deliberately: a war is something to watch, and the pools
 * are part of what makes it worth watching. Nothing identifying a bettor
 * is ever in the response — only totals and a headcount — so there is
 * nothing here to hide from a signed-out reader.
 */

const FILTERS: { value: WarFilter; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "open", label: "Open" },
  { value: "finished", label: "Done" },
  { value: "mine", label: "Mine" },
  { value: "all", label: "All" },
];

export default function WarsPage() {
  const [filter, setFilter] = useState<WarFilter>("live");
  const wars = useWars(filter);

  return (
    <main>
      <Screen width="md" className="flex flex-col gap-8 py-8">
        <header className="flex flex-col gap-3">
          <Label>Two clans, four hours, one score</Label>
          <Display size="title">Wars</Display>
        </header>

        <div className="flex flex-wrap items-center gap-6">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={cn(
                "font-pixel text-[10px] uppercase tracking-[0.12em] transition-all duration-200",
                filter === option.value
                  ? "text-cyan [text-shadow:var(--glow-cyan)]"
                  : "text-ink-faint hover:text-ink-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Rule />

        {wars.isLoading ? (
          <Loading />
        ) : (wars.data?.length ?? 0) === 0 ? (
          <Empty icon="fire" title="No wars here">
            {filter === "mine"
              ? "Your clan has not been in one yet."
              : "A clan leader has to challenge another full clan to start one."}
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {wars.data?.map((war) => (
              <WarRow key={war.id} war={war} />
            ))}
          </ul>
        )}
      </Screen>
    </main>
  );
}

/* ----------------------------------------------------------------- row */

const STATUS_TONE: Record<WarStatus, string> = {
  proposed: "text-caution",
  accepted: "text-cyan",
  live: "text-danger",
  judging: "text-caution",
  finished: "text-ink-faint",
  declined: "text-ink-faint",
  withdrawn: "text-ink-faint",
  void: "text-ink-faint",
};

function WarRow({ war }: { war: WarView }) {
  const live = war.status === "live";
  const settled = Boolean(war.outcome);

  const challengerWon = war.outcome === "challenger";
  const opponentWon = war.outcome === "opponent";

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={`/wars/${war.id}`} className="group flex flex-col gap-3 py-5">
        {/* status line */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {live ? (
              <span
                className="size-1.5 animate-[pulse-glow_1.6s_ease-in-out_infinite] bg-danger"
                style={{ boxShadow: "0 0 8px rgb(255 59 48 / 0.9)" }}
              />
            ) : null}
            <span
              className={cn(
                "font-pixel text-[9px] uppercase tracking-[0.14em]",
                STATUS_TONE[war.status],
              )}
            >
              {war.status}
            </span>
          </div>

          <WarTiming war={war} />
        </div>

        {/* the two sides */}
        <div className="flex items-center gap-4">
          <Side
            name={war.challenger.name}
            score={war.challenger.score}
            pool={war.pools.challenger}
            won={challengerWon}
            lost={settled && !challengerWon && war.outcome !== "draw"}
            align="left"
          />

          <span className="shrink-0 font-pixel text-[10px] text-ink-faint">VS</span>

          <Side
            name={war.opponent.name}
            score={war.opponent.score}
            pool={war.pools.opponent}
            won={opponentWon}
            lost={settled && !opponentWon && war.outcome !== "draw"}
            align="right"
          />
        </div>

        {/* the book */}
        {war.bettors > 0 ? (
          <div className="flex items-center justify-between gap-4">
            <Label tone="faint">
              {war.bettors} {war.bettors === 1 ? "bettor" : "bettors"} ·{" "}
              {formatNumber(war.pools.challenger + war.pools.opponent)} staked
            </Label>
            {war.myBet ? (
              <Label tone="coin">
                You: {formatNumber(war.myBet.stake)} on{" "}
                {war.myBet.side === "challenger"
                  ? war.challenger.name
                  : war.opponent.name}
              </Label>
            ) : war.bookOpen ? (
              <Label tone="good">Book open</Label>
            ) : null}
          </div>
        ) : war.bookOpen ? (
          <Label tone="good">Book open · nobody in yet</Label>
        ) : null}
      </Link>

      <Rule />
    </motion.li>
  );
}

function Side({
  name,
  score,
  pool,
  won,
  lost,
  align,
}: {
  name: string;
  score: number;
  pool: number;
  won: boolean;
  lost: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1",
        align === "right" ? "items-end text-right" : "items-start",
      )}
    >
      <span
        className={cn(
          "w-full truncate font-pixel text-[12px] uppercase tracking-[0.08em] transition-colors",
          won
            ? "text-good [text-shadow:0_0_6px_rgb(47_217_107/0.8)]"
            : lost
              ? "text-ink-faint"
              : "text-ink group-hover:text-cyan",
        )}
      >
        {name}
      </span>
      <div
        className={cn(
          "flex items-center gap-2.5",
          align === "right" && "flex-row-reverse",
        )}
      >
        <span className="font-pixel text-[16px] tabular-nums text-cyan text-glow-cyan">
          {score}
        </span>
        {pool > 0 ? (
          <span className="font-pixel text-[9px] tabular-nums text-coin">
            {formatNumber(pool)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Starts in / ends in / finished. One line, whichever applies. */
function WarTiming({ war }: { war: WarView }) {
  if (war.status === "live") {
    return (
      <Label tone="heart">{formatClock(secondsUntil(war.endsAt))} left</Label>
    );
  }
  if (war.status === "proposed" || war.status === "accepted") {
    const until = secondsUntil(war.startsAt);
    return (
      <Label tone="faint">
        {until > 0 ? `starts in ${formatClock(until)}` : "starting"}
      </Label>
    );
  }
  if (war.outcome === "draw") return <Label tone="faint">Draw</Label>;
  if (war.outcome === "void") {
    return <Label tone="faint">Void · stakes returned</Label>;
  }
  return (
    <span className="flex items-center gap-2">
      <Icon name="crown" size="xs" glow />
      <Label tone="faint">Settled</Label>
    </span>
  );
}
