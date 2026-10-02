"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { BackLink } from "@/components/nav";
import {
  Body,
  Button,
  Display,
  Empty,
  ErrorNote,
  Label,
  Loading,
  Rule,
  Screen,
} from "@/components/ui";
import type { ApiError, WarSide, WarView } from "@/lib/api";
import { useDashboard, usePlaceBet, useWar } from "@/lib/queries";
import { useCountdown } from "@/lib/hooks";
import { cn, formatClock, formatNumber } from "@/lib/utils";

/**
 * One war, with the book.
 *
 * The betting UI is the sensitive part of this whole app — coins can be
 * bought with real money — so it states the arithmetic rather than
 * implying it:
 *
 *   - `returnPerCoin` is **null** for a side nobody has backed, and the
 *     honest answer there is "your stake back", not a made-up multiple.
 *     Rendering a number would be a quote we cannot honour.
 *   - The rake is shown as a percentage, always, next to the return.
 *   - `canBet.allowed` is server-truth and carries its own reason — a
 *     member of either clan is barred. We show the reason instead of a
 *     greyed-out button that explains nothing.
 */
export default function WarPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const war = useWar(id);
  const dashboard = useDashboard();
  const balance = dashboard.data?.enrolment?.coins ?? 0;

  if (war.isLoading) {
    return (
      <Screen width="md">
        <Loading />
      </Screen>
    );
  }

  if (war.isError || !war.data) {
    return (
      <Screen width="md">
        <BackLink href="/wars" />
        <Empty icon="warning" title="No such war" />
      </Screen>
    );
  }

  const data = war.data;
  const live = data.status === "live";
  const ticking = live ? data.endsAt : data.startsAt;

  return (
    <main>
      <Screen width="md" className="flex flex-col gap-9 py-4">
        <BackLink href="/wars" />

        {/* the clock on the war itself */}
        <WarClock war={data} target={ticking} />

        {/* scoreboard */}
        <section className="flex items-stretch gap-5">
          <Scoreboard
            name={data.challenger.name}
            score={data.challenger.score}
            won={data.outcome === "challenger"}
          />
          <div className="flex shrink-0 items-center">
            <span className="font-pixel text-[11px] text-ink-faint">VS</span>
          </div>
          <Scoreboard
            name={data.opponent.name}
            score={data.opponent.score}
            won={data.outcome === "opponent"}
            align="right"
          />
        </section>

        {/* outcome, once there is one */}
        {data.outcome ? <Outcome war={data} /> : null}

        <Rule tone="blue" />

        {/* the book */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <Label>The book</Label>
            <Label tone="faint">{data.rakePercent}% rake</Label>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <PoolColumn
              label={data.challenger.name}
              pool={data.pools.challenger}
              returnPerCoin={data.returnPerCoin.challenger}
              mine={data.myBet?.side === "challenger" ? data.myBet.stake : null}
            />
            <PoolColumn
              label={data.opponent.name}
              pool={data.pools.opponent}
              returnPerCoin={data.returnPerCoin.opponent}
              mine={data.myBet?.side === "opponent" ? data.myBet.stake : null}
              align="right"
            />
          </div>

          <Label tone="faint">
            {data.bettors} {data.bettors === 1 ? "bettor" : "bettors"} ·{" "}
            {formatNumber(data.pools.challenger + data.pools.opponent)} coins in
          </Label>
        </section>

        {/* your position, or the form to take one */}
        {data.myBet ? (
          <MyBet war={data} />
        ) : data.bookOpen ? (
          data.canBet.allowed ? (
            <BetForm war={data} balance={balance} />
          ) : (
            <div className="flex flex-col gap-2.5 py-2">
              <Label tone="heart">You cannot bet on this one</Label>
              <Body size="sm">
                {data.canBet.reason ??
                  "Members of either clan are barred from the book."}
              </Body>
            </div>
          )
        ) : (
          <Label tone="faint">The book is closed.</Label>
        )}
      </Screen>
    </main>
  );
}

/* ---------------------------------------------------------------- parts */

function WarClock({ war, target }: { war: WarView; target: string }) {
  const seconds = useCountdown(target);
  const live = war.status === "live";

  if (war.outcome) {
    return (
      <div className="flex flex-col items-center gap-2 py-2">
        <Label tone="faint">Settled</Label>
        <Display size="hero" tone={war.outcome === "void" ? "muted" : "bone"}>
          {war.outcome === "draw"
            ? "Draw"
            : war.outcome === "void"
              ? "Void"
              : "Finished"}
        </Display>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <Label tone={live ? "heart" : "faint"}>
        {live ? "Time left" : war.status === "judging" ? "Judging" : "Starts in"}
      </Label>
      <span
        className={cn(
          "font-pixel text-[clamp(32px,10vw,56px)] leading-none tabular-nums",
          live ? "text-danger [text-shadow:0_0_6px_rgb(255_59_48/1),0_0_26px_rgb(255_59_48/0.6)]" : "text-cyan text-glow-lg",
        )}
      >
        {formatClock(seconds)}
      </span>
    </div>
  );
}

function Scoreboard({
  name,
  score,
  won,
  align = "left",
}: {
  name: string;
  score: number;
  won: boolean;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-2",
        align === "right" ? "items-end text-right" : "items-start",
      )}
    >
      <div className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse")}>
        {won ? <Icon name="crown" size="xs" glow /> : null}
        <span className="w-full truncate font-pixel text-[11px] uppercase tracking-[0.08em] text-ink">
          {name}
        </span>
      </div>
      <span
        className={cn(
          "font-pixel text-[clamp(28px,9vw,44px)] leading-none tabular-nums",
          won ? "text-good [text-shadow:0_0_8px_rgb(47_217_107/0.8)]" : "text-cyan text-glow-cyan",
        )}
      >
        {score}
      </span>
    </div>
  );
}

function PoolColumn({
  label,
  pool,
  returnPerCoin,
  mine,
  align = "left",
}: {
  label: string;
  pool: number;
  returnPerCoin: number | null;
  mine: number | null;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("flex flex-col gap-2", align === "right" && "items-end text-right")}>
      <Label tone="faint">{label}</Label>
      <span className="font-pixel text-[18px] tabular-nums text-coin text-glow-coin">
        {formatNumber(pool)}
      </span>
      <Label tone={returnPerCoin === null ? "faint" : "good"}>
        {/* Null means nobody has backed this side. The payout rule in that
            case is a refund, so say that rather than print a number. */}
        {returnPerCoin === null
          ? "stake back"
          : `×${returnPerCoin.toFixed(2)} a coin`}
      </Label>
      {mine !== null ? <Label tone="coin">You: {formatNumber(mine)}</Label> : null}
    </div>
  );
}

function Outcome({ war }: { war: WarView }) {
  const winner =
    war.outcome === "challenger"
      ? war.challenger.name
      : war.outcome === "opponent"
        ? war.opponent.name
        : null;

  return (
    <div className="flex flex-col gap-2.5 py-2">
      {winner ? (
        <Label tone="good">{winner} took it</Label>
      ) : war.outcome === "void" ? (
        <Label tone="heart">Called off · every stake returned</Label>
      ) : (
        <Label tone="faint">Drawn · stakes returned</Label>
      )}
      {war.voidReason ? <Body size="sm">{war.voidReason}</Body> : null}
      {war.settlementReason ? (
        <Label tone="faint">Settlement: {war.settlementReason}</Label>
      ) : null}
    </div>
  );
}

function MyBet({ war }: { war: WarView }) {
  const bet = war.myBet;
  if (!bet) return null;

  const side = bet.side === "challenger" ? war.challenger.name : war.opponent.name;

  return (
    <div className="flex flex-col gap-3 py-2">
      <Label tone="coin">Your bet</Label>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <span className="font-pixel text-[20px] tabular-nums text-coin text-glow-coin">
          {formatNumber(bet.stake)}
        </span>
        <span className="font-pixel text-[11px] uppercase tracking-[0.1em] text-ink">
          on {side}
        </span>
      </div>
      {bet.settled ? (
        <Label tone={bet.payout > 0 ? "good" : "heart"}>
          {bet.payout > 0 ? `Paid ${formatNumber(bet.payout)}` : "Lost"}
        </Label>
      ) : (
        <Label tone="faint">Open until it settles</Label>
      )}
    </div>
  );
}

/**
 * Placing a bet.
 *
 * A slider rather than a number field: the thing a bettor actually wants
 * to express is "a bit of what I have" or "all of it", and typing 1200
 * when the balance is 120 only produces a server error. The slider cannot
 * exceed the balance, so an overspend is unreachable rather than rejected.
 */
function BetForm({ war, balance }: { war: WarView; balance: number }) {
  const place = usePlaceBet(war.id);
  const [side, setSide] = useState<WarSide | null>(null);
  const [coins, setCoins] = useState(Math.min(10, balance));

  const error = place.error as ApiError | null;
  const max = Math.max(0, balance);

  if (max === 0) {
    return (
      <div className="flex flex-col gap-2 py-2">
        <Label tone="heart">No coins</Label>
        <Body size="sm">Vote on hand-ins to earn some, then come back.</Body>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6 py-2">
      <Label>Back a side</Label>

      <div className="flex gap-10">
        {(["challenger", "opponent"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSide(value)}
            aria-pressed={side === value}
            className={cn(
              "group flex items-center gap-2.5 py-2 font-pixel text-[12px] uppercase tracking-[0.1em] transition-all duration-200",
              side === value
                ? "text-cyan [text-shadow:var(--glow-cyan)]"
                : "text-ink-faint hover:text-ink",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "transition-opacity",
                side === value ? "opacity-100" : "opacity-0 group-hover:opacity-40",
              )}
            >
              ▶
            </span>
            {value === "challenger" ? war.challenger.name : war.opponent.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label tone="faint">Stake</Label>
          <span className="font-pixel text-[16px] tabular-nums text-coin text-glow-coin">
            {formatNumber(coins)}
          </span>
        </div>

        <input
          type="range"
          min={1}
          max={max}
          value={coins}
          onChange={(event) => setCoins(Number(event.target.value))}
          aria-label="Coins to stake"
          className="h-1 w-full cursor-pointer appearance-none bg-blue-dim accent-coin"
        />

        <div className="flex items-center justify-between">
          <Label tone="faint">1</Label>
          <button
            type="button"
            onClick={() => setCoins(max)}
            className="font-body text-[10px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-coin"
          >
            All {formatNumber(max)}
          </button>
        </div>
      </div>

      {error ? <ErrorNote>{error.message}</ErrorNote> : null}

      <Button
        variant="coin"
        size="lg"
        fullWidth
        disabled={!side}
        loading={place.isPending}
        onClick={() => {
          if (!side) return;
          place.mutate({ side, coins });
        }}
      >
        {side ? `Stake ${formatNumber(coins)}` : "Pick a side"}
      </Button>
    </section>
  );
}
