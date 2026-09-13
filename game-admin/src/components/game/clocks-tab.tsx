"use client";

import { useEffect, useState } from "react";
import { gameApi } from "@/lib/api";
import type { ClockRow, ClockStatus } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  Badge,
  cardCls,
  chipCls,
  Empty,
  ErrorNote,
  labelCls,
  Loading,
  Panel,
  Stat,
  tableCls,
  TableScroll,
  tdCls,
  thCls,
  theadCls,
  trCls,
  type Tone,
} from "../ui";
import { formatDateTime, n, words } from "./game-ui";

type ClockFilter = ClockStatus | "running" | "all";

const FILTERS: { value: ClockFilter; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "all", label: "All" },
  { value: "offered", label: "Offered" },
  { value: "accepted", label: "Accepted" },
  { value: "submitted", label: "Submitted" },
  { value: "expired", label: "Expired" },
  { value: "declined", label: "Declined" },
];

const STATUS_TONE: Record<ClockStatus, Tone> = {
  offered: "info",
  accepted: "solid",
  submitted: "positive",
  expired: "danger",
  declined: "neutral",
};

const STATUS_WORD: Record<ClockStatus, string> = {
  offered: "Offered",
  accepted: "Running",
  submitted: "Submitted",
  expired: "Expired",
  declined: "Declined",
};

/** How often the list is fetched again while the screen is open. */
const RELOAD_MS = 30_000;

/** Seconds until `expiresAt`, measured against the ticking clock. */
function remaining(clock: ClockRow, now: number): number | null {
  if (!clock.expiresAt) return null;
  return Math.floor((new Date(clock.expiresAt).getTime() - now) / 1000);
}

/** "04:07", or "−00:42" once past zero, with a real minus sign. */
function mmss(seconds: number): string {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${seconds < 0 ? "−" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Only an offered or accepted clock is still counting; the rest have stopped. */
function isLive(status: ClockStatus): boolean {
  return status === "offered" || status === "accepted";
}

/**
 * Tasks people hold and the timers running on them.
 *
 * The first place to look when a player says their clock ran out unfairly:
 * when they accepted, how long they had, and whether the sweep took a heart.
 */
export function ClocksTab() {
  const [filter, setFilter] = useState<ClockFilter>("running");
  const [now, setNow] = useState(() => Date.now());
  const { data, loading, error, reload } = useAsync(
    () => gameApi.listClocks(filter),
    [filter],
  );

  // The countdown ticks locally; `secondsLeft` is only right at load.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(reload, RELOAD_MS);
    return () => clearInterval(t);
  }, [reload]);

  const clocks = data?.clocks ?? [];
  let running = 0;
  let offered = 0;
  let underFive = 0;
  let overdue = 0;
  for (const c of clocks) {
    if (c.status === "offered") offered += 1;
    if (c.status !== "accepted") continue;
    running += 1;
    const left = remaining(c, now);
    if (left == null) continue;
    if (left < 0) overdue += 1;
    else if (left < 300) underFive += 1;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------- the count */}
      <div
        className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}
      >
        <div className="p-5">
          <Stat label="Running now" value={n(running)} hint="accepted, clock on" />
        </div>
        <div className="p-5">
          <Stat label="Offered" value={n(offered)} hint="waiting to be accepted" />
        </div>
        <div className="p-5">
          <Stat
            label="Under 5 min"
            value={n(underFive)}
            hint="left on an accepted clock"
            tone={underFive > 0 ? "caution" : undefined}
          />
        </div>
        <div className="p-5">
          <Stat
            label="Overdue"
            value={n(overdue)}
            hint="past zero, sweep not yet run"
            tone={overdue > 0 ? "danger" : undefined}
          />
        </div>
      </div>

      {/* -------------------------------------------------------- the list */}
      <Panel
        title="Held tasks"
        bleed
        aside={
          data && (
            <span className="tnum text-[11px] text-faint">
              {n(clocks.length)} {clocks.length === 1 ? "clock" : "clocks"}
            </span>
          )
        }
      >
        <div className="flex flex-col gap-3 border-t border-line px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <span className={labelCls} id="clocks-status-label">
              Status
            </span>
            <div
              role="group"
              aria-labelledby="clocks-status-label"
              className="flex flex-wrap gap-2"
            >
              {FILTERS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={filter === chip.value}
                  onClick={() => setFilter(chip.value)}
                  className={chipCls(filter === chip.value)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] leading-5 text-faint">
            An accepted clock that reaches zero is expired by a sweep that runs
            every minute and costs a heart, so an overdue row here is normal for
            up to a minute.
          </p>
        </div>

        {loading && !data && (
          <div className="px-5">
            <Loading label="Loading clocks" />
          </div>
        )}
        {error && (
          <div className="px-5">
            <ErrorNote message={error} />
          </div>
        )}

        {data && clocks.length === 0 && (
          <Empty>
            No clocks {filter === "all" ? "in the live season" : `with status “${words(filter)}”`}.
            Tasks show up here once they are offered to a player.
          </Empty>
        )}

        {clocks.length > 0 && (
          <TableScroll>
            <table className={tableCls}>
              <thead>
                <tr className={theadCls}>
                  <th className={thCls}>Handle</th>
                  <th className={thCls}>Task</th>
                  <th className={`${thCls} text-right`}>Day</th>
                  <th className={thCls}>Status</th>
                  <th className={`${thCls} text-right`}>Left</th>
                  <th className={thCls}>Clock</th>
                  <th className={thCls}>Accepted</th>
                </tr>
              </thead>
              <tbody>
                {clocks.map((c) => (
                  <ClockLine key={c.id} clock={c} now={now} />
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </div>
  );
}

function ClockLine({ clock: c, now }: { clock: ClockRow; now: number }) {
  const left = isLive(c.status) ? remaining(c, now) : null;
  const leftCls =
    left == null
      ? "text-faint"
      : left < 60
        ? "text-danger"
        : left < 300
          ? "text-caution"
          : "text-ink";

  return (
    <tr className={trCls}>
      <td className={tdCls}>
        <span className="block text-[13px] font-bold">{c.handle}</span>
        {c.clan && (
          <span className="mt-0.5 block text-[11px] text-faint">{c.clan}</span>
        )}
      </td>
      <td className={`${tdCls} min-w-[16rem]`}>
        <span className="block leading-5">{c.task}</span>
      </td>
      <td className={`${tdCls} tnum text-right`}>{c.day}</td>
      <td className={tdCls}>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={STATUS_TONE[c.status]}>{STATUS_WORD[c.status]}</Badge>
          {c.heartBurned && <Badge tone="danger">Heart lost</Badge>}
        </span>
      </td>
      <td
        className={`${tdCls} font-display tnum whitespace-nowrap text-right text-[18px] leading-none ${leftCls}`}
      >
        {left == null ? "—" : mmss(left)}
      </td>
      <td className={`${tdCls} tnum whitespace-nowrap text-muted`}>
        of {c.clockMinutes} min
      </td>
      <td className={`${tdCls} whitespace-nowrap text-[11px] text-faint`}>
        {formatDateTime(c.acceptedAt)}
      </td>
    </tr>
  );
}
