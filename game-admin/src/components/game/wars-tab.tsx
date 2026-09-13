"use client";

import { useState } from "react";
import { gameApi } from "@/lib/api";
import type { WarFilter, WarStatus, WarView } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  Badge,
  btnGhost,
  btnSecondary,
  Card,
  cardCls,
  chipCls,
  Empty,
  ErrorNote,
  eyebrow,
  Field,
  inputCls,
  Loading,
  Note,
  Panel,
  Stat,
  type Tone,
} from "../ui";
import { ConfirmButton, formatDateTime, n, timeAgo, useAction, words } from "./game-ui";

const FILTERS: { value: WarFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Book open" },
  { value: "live", label: "Live" },
  { value: "finished", label: "Finished" },
];

const STATUS_TONE: Record<WarStatus, Tone> = {
  proposed: "neutral",
  accepted: "info",
  live: "solid",
  judging: "caution",
  settled: "positive",
  void: "neutral",
};

const STATUS_WORD: Record<WarStatus, string> = {
  proposed: "Challenged",
  accepted: "Book open",
  live: "Live",
  judging: "Judging",
  settled: "Settled",
  void: "Void",
};

const REFUND_WHY: Record<string, string> = {
  draw: "A draw, so every stake went back.",
  one_sided: "Everyone backed the same side, so there was no bet — every stake went back.",
  no_bets: "Nobody bet on it.",
  void: "Called off, and every stake went back.",
};

/**
 * Clan wars, from the operator's side.
 *
 * Two levers and a lot of reading. The book runs itself — the clock starts,
 * ends and settles wars every minute — so this screen exists for the cases
 * the clock cannot decide: a war stuck in judging on a clip nobody will
 * review, and a war that has to be called off because somebody cheated.
 *
 * Coins only. There is nothing on this screen that is money, and nothing
 * here converts one into the other.
 */
export function WarsTab() {
  const [filter, setFilter] = useState<WarFilter>("all");
  const data = useAsync(() => gameApi.listWars(filter), [filter]);
  const { note, busy, act } = useAction(data.reload);

  const wars = data.data?.wars ?? [];
  const all = wars;
  const staked = all.reduce((sum, w) => sum + w.pools.challenger + w.pools.opponent, 0);
  const judging = all.filter((w) => w.status === "judging").length;
  const live = all.filter((w) => w.status === "live").length;
  const open = all.filter((w) => w.status === "accepted").length;

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}
      >
        <div className="p-5">
          <Stat label="Book open" value={open} hint="taking bets now" />
        </div>
        <div className="p-5">
          <Stat label="Live" value={live} hint="clocks running" />
        </div>
        <div className="p-5">
          <Stat
            label="Judging"
            value={judging}
            hint="waiting on hand-ins"
            tone={judging > 0 ? "caution" : undefined}
          />
        </div>
        <div className="p-5">
          <Stat label="Coins staked" value={n(staked)} hint="across these wars" />
        </div>
      </div>

      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-[12px] leading-6 text-muted">
            The clock moves every war along each minute: it opens the four
            hours, closes them, and settles once the window&apos;s hand-ins are
            judged — or 48 hours after it ends, whichever comes first. Bets are
            coins only, and nothing converts them back to money.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              act(
                () => gameApi.tickWars(),
                (r) => {
                  const t = r as Awaited<ReturnType<typeof gameApi.tickWars>>;
                  return `Clock ran: ${t.started} started, ${t.ended} ended, ${t.settled} settled, ${t.voided} voided.`;
                },
              )
            }
            className={btnSecondary}
          >
            Run the clock now
          </button>
        </div>
        {note && (
          <div className="mt-3 border-t border-line pt-3">
            <Note>{note}</Note>
          </div>
        )}
      </Card>

      <Panel
        title="Wars"
        aside={
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={chipCls(filter === f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
        bleed
      >
        {data.loading && !data.data && (
          <div className="px-5">
            <Loading label="Loading wars" />
          </div>
        )}
        {data.error && (
          <div className="px-5">
            <ErrorNote message={data.error} />
          </div>
        )}
        {data.data && wars.length === 0 && (
          <Empty>
            No wars here. A clan leader challenges another full clan from the
            game; it appears here the moment they do.
          </Empty>
        )}
        <ul>
          {wars.map((war) => (
            <WarRow
              key={war.id}
              war={war}
              busy={busy}
              onSettle={() =>
                act(
                  () => gameApi.settleWar(war.id),
                  `Settled ${war.challenger.name} v ${war.opponent.name} on what has been judged.`,
                )
              }
              onVoid={(reason) =>
                act(
                  () => gameApi.voidWar(war.id, reason),
                  `Called off ${war.challenger.name} v ${war.opponent.name}. Every stake was refunded.`,
                )
              }
            />
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function WarRow({
  war,
  busy,
  onSettle,
  onVoid,
}: {
  war: WarView;
  busy: boolean;
  onSettle: () => void;
  onVoid: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const total = war.pools.challenger + war.pools.opponent;
  const over = war.status === "settled" || war.status === "void";
  const canSettle = war.status === "live" || war.status === "judging";
  const scored = war.status === "settled" || war.status === "judging";

  const share = (side: "challenger" | "opponent") =>
    total === 0 ? 50 : Math.round((war.pools[side] / total) * 100);

  return (
    <li className="border-t border-line">
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <Badge tone={STATUS_TONE[war.status]}>{STATUS_WORD[war.status]}</Badge>
            <span className="truncate text-[14px] font-bold">
              {war.challenger.name}
              <span className="px-2 font-normal text-faint">v</span>
              {war.opponent.name}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-faint">
              {war.status === "accepted" || war.status === "proposed"
                ? `starts ${formatDateTime(war.startsAt)}`
                : war.status === "live"
                  ? `ends ${formatDateTime(war.endsAt)}`
                  : war.settledAt
                    ? `settled ${timeAgo(war.settledAt)}`
                    : `ended ${timeAgo(war.endsAt)}`}
            </span>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={btnGhost}
            >
              {open ? "Close" : "Details"}
            </button>
          </div>
        </div>

        {/* The scoreline and the book, side by side: the two things anyone
            looking at a war actually wants to know. */}
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Side
              name={war.challenger.name}
              score={war.challenger.score}
              scored={scored}
              won={war.outcome === "challenger"}
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
              {war.outcome === "draw" ? "draw" : "v"}
            </span>
            <Side
              name={war.opponent.name}
              score={war.opponent.score}
              scored={scored}
              won={war.outcome === "opponent"}
              alignRight
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className={eyebrow}>The book</span>
              <span className="tnum text-faint">
                {n(total)} coins · {war.bettors} {war.bettors === 1 ? "bettor" : "bettors"} ·{" "}
                {war.rakePercent}% rake
              </span>
            </div>
            {/* One bar, split by where the coins are. A lopsided book is the
                first sign of a war people think is already decided. */}
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-raised">
              <div
                className="bg-ink transition-[width]"
                style={{ width: `${share("challenger")}%` }}
              />
              <div
                className="bg-line-strong transition-[width]"
                style={{ width: `${share("opponent")}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[12px]">
              <PoolLabel
                coins={war.pools.challenger}
                ret={war.returnPerCoin.challenger}
              />
              <PoolLabel
                coins={war.pools.opponent}
                ret={war.returnPerCoin.opponent}
                alignRight
              />
            </div>
          </div>
        </div>

        {over && war.settlementReason && war.settlementReason !== "paid" && (
          <p className="mt-3 text-[12px] text-muted">
            {war.status === "void" && war.voidReason
              ? `${war.voidReason} Every stake went back.`
              : REFUND_WHY[war.settlementReason] ?? words(war.settlementReason)}
          </p>
        )}
      </div>

      {open && (
        <div className="border-t border-line bg-raised px-5 py-5">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-[12px]">
              <dt className="text-faint">War</dt>
              <dd className="font-mono text-[11px]">{war.id}</dd>
              <dt className="text-faint">Window</dt>
              <dd>
                {formatDateTime(war.startsAt)} – {formatDateTime(war.endsAt)}
              </dd>
              <dt className="text-faint">Outcome</dt>
              <dd>{war.outcome ? words(war.outcome) : "—"}</dd>
              <dt className="text-faint">Settled as</dt>
              <dd>{war.settlementReason ? words(war.settlementReason) : "—"}</dd>
              <dt className="text-faint">Rake frozen at</dt>
              <dd>{war.rakePercent}%</dd>
            </dl>

            <div className="flex flex-col gap-4">
              {canSettle && (
                <div>
                  <p className={eyebrow}>Settle now</p>
                  <p className="mt-1 text-[12px] leading-5 text-muted">
                    Scores the war on what has been judged and pays the book.
                    Anything from the window still in the review queue will not
                    count. Use it for a war stuck on a clip nobody will review.
                  </p>
                  <div className="mt-2">
                    <ConfirmButton
                      label="Settle this war"
                      confirmLabel="Press again to pay out"
                      disabled={busy}
                      onConfirm={onSettle}
                      className={btnSecondary}
                    />
                  </div>
                </div>
              )}

              {!over && (
                <div className={canSettle ? "border-t border-line pt-4" : ""}>
                  <p className={eyebrow}>Call it off</p>
                  <p className="mt-1 text-[12px] leading-5 text-muted">
                    Refunds every stake. The bettors and both clans are told the
                    reason, word for word.
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <div className="min-w-[240px] flex-1">
                      <Field id={`void-${war.id}`} label="Reason">
                        <input
                          id={`void-${war.id}`}
                          value={reason}
                          maxLength={200}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="A member of one clan was flagged for cheating."
                          className={inputCls}
                        />
                      </Field>
                    </div>
                    <ConfirmButton
                      label="Void and refund"
                      confirmLabel="Press again to refund"
                      disabled={busy || reason.trim().length < 3}
                      onConfirm={() => onVoid(reason.trim())}
                      className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-danger/40 bg-danger-tint px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-danger hover:border-danger disabled:cursor-not-allowed disabled:opacity-45"
                    />
                  </div>
                </div>
              )}

              {over && (
                <p className="text-[12px] text-muted">
                  This war is over. Nothing here can be changed, and there is no
                  lever that re-opens a settled book.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function Side({
  name,
  score,
  scored,
  won,
  alignRight = false,
}: {
  name: string;
  score: number;
  scored: boolean;
  won: boolean;
  alignRight?: boolean;
}) {
  return (
    <div className={`min-w-0 ${alignRight ? "text-right" : ""}`}>
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
        {name}
      </p>
      <p
        className={`font-display tnum mt-1 text-[28px] leading-none ${
          won ? "text-positive" : scored ? "text-ink" : "text-line-strong"
        }`}
      >
        {scored ? n(score) : "—"}
      </p>
    </div>
  );
}

function PoolLabel({
  coins,
  ret,
  alignRight = false,
}: {
  coins: number;
  ret: number | null;
  alignRight?: boolean;
}) {
  return (
    <span className={alignRight ? "text-right" : ""}>
      <span className="tnum font-bold">{n(coins)}</span>
      <span className="text-faint">
        {" "}
        · {ret === null ? "stake back" : `×${ret.toFixed(2)} per coin`}
      </span>
    </span>
  );
}
