"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import type { TrafficPage } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { chipCls, ErrorNote, labelCls, Loading } from "../ui";

const RANGES = [7, 30, 90] as const;

/** Page order, so the funnel reads top to bottom the way the page does. */
const HOME_SECTION_ORDER = [
  "drop",
  "wanted",
  "categories",
  "archive",
  "idea",
  "values",
  "join",
] as const;

const SECTION_LABELS: Record<string, string> = {
  drop: "The drop",
  wanted: "Most wanted",
  categories: "Categories",
  archive: "The archive",
  idea: "The idea",
  values: "What we stand for",
  join: "Never miss a drop",
};

/**
 * A day key in UTC, because the database is.
 *
 * This used to build the key from local time. Every timestamp in `page_views`
 * is UTC, and the admin looking at it is four hours ahead — so between 8pm and
 * midnight in Tbilisi, "today" asked for a window that had not started yet and
 * the report read zero for traffic that was happening as it was read.
 */
function dateKey(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function TrafficTab() {
  const [rangeDays, setRangeDays] = useState<(typeof RANGES)[number]>(7);
  const [metric, setMetric] = useState<"views" | "visitors">("visitors");
  const [hovered, setHovered] = useState<number | null>(null);
  const { data, loading, error } = useAsync(
    () =>
      adminApi.getTraffic({
        from: dateKey(rangeDays - 1),
        to: dateKey(0),
      }),
    [rangeDays],
  );

  if (loading) return <Loading label="Loading traffic" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const tiles = [
    { label: "Visitors today", value: data.summary.todayVisitors },
    { label: "Views today", value: data.summary.todayViews },
    { label: `Visitors — ${rangeDays}d`, value: data.summary.rangeVisitors },
    { label: `Views — ${rangeDays}d`, value: data.summary.rangeViews },
  ];

  // Fill in zero-days so the chart shows the full range.
  const byDate = new Map(data.days.map((d) => [d.date, d]));
  const days = Array.from({ length: rangeDays }, (_, i) => {
    const date = dateKey(rangeDays - 1 - i);
    const row = byDate.get(date);
    return {
      date,
      value: row ? row[metric] : 0,
      views: row?.views ?? 0,
      visitors: row?.visitors ?? 0,
    };
  });
  const maxValue = Math.max(1, ...days.map((d) => d.value));

  return (
    <div className="flex flex-col gap-12">
      <ul className="grid grid-cols-2 gap-px border border-subtle bg-subtle sm:grid-cols-4">
        {tiles.map(({ label, value }) => (
          <li key={label} className="bg-background p-4 sm:p-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              {label}
            </p>
            <p className="mt-2 font-display text-xl uppercase tracking-tight sm:text-2xl">
              {value}
            </p>
          </li>
        ))}
      </ul>

      <section aria-label="Traffic chart">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRangeDays(r)}
                className={chipCls(rangeDays === r)}
              >
                {r} days
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(["visitors", "views"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={chipCls(metric === m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <div
            className="relative flex h-44 items-end gap-px border-b border-subtle sm:gap-0.5"
            onMouseLeave={() => setHovered(null)}
          >
            {hovered !== null && days[hovered] && (
              <div
                className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-foreground px-2.5 py-1.5 text-background"
                style={{ left: `${((hovered + 0.5) / days.length) * 100}%` }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.1em]">
                  {days[hovered].date}
                </p>
                <p className="text-[10px]">
                  Visitors: {days[hovered].visitors} · Views:{" "}
                  {days[hovered].views}
                </p>
              </div>
            )}
            {days.map((day, i) => (
              <div
                key={day.date}
                onMouseEnter={() => setHovered(i)}
                className="group relative flex-1 cursor-crosshair"
              >
                <div
                  className={`w-full transition-colors ${
                    hovered === i
                      ? "bg-muted"
                      : day.value > 0
                        ? "bg-foreground"
                        : "bg-subtle"
                  }`}
                  style={{
                    height: `${day.value > 0 ? Math.max(4, (day.value / maxValue) * 176) : 2}px`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
            <span>{days[0]?.date.slice(5)}</span>
            <span>{days[days.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      </section>

      <ScrollFunnel from={dateKey(rangeDays - 1)} to={dateKey(0)} />

      <div className="grid gap-12 lg:grid-cols-2">
        <PathList title="Top pages" items={data.topPages} />
        <PathList title="Top products by views" items={data.topProducts} />
      </div>
    </div>
  );
}

/**
 * How far down the home page people get, and what the intro costs.
 *
 * The page has seven acts and, until now, no evidence about which of them
 * anybody reaches. The number to look for is the row where the share falls off
 * a cliff — that is the section losing people, and everything below it is
 * being written for an audience that never arrives.
 */
function ScrollFunnel({ from, to }: { from: string; to: string }) {
  const { data, loading } = useAsync(
    () => adminApi.getScrollReach({ from, to }),
    [from, to],
  );
  const { data: intro } = useAsync(
    () => adminApi.getIntroReach({ from, to }),
    [from, to],
  );

  // Server order is by reach; the page's own order is what makes a funnel
  // readable, so it is imposed here.
  const ordered = HOME_SECTION_ORDER.map((label) => ({
    label,
    row: data?.sections.find((section) => section.label === label),
  })).filter((entry) => entry.row);

  return (
    <section aria-label="How far down the home page people get">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className={labelCls}>Home page — how far they get</p>
        {intro && intro.shown + intro.skipped > 0 && (
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted">
            Intro played for {intro.shown} · skipped for {intro.skipped}
          </p>
        )}
      </div>

      {loading && <Loading label="Loading scroll depth" />}

      {data && data.visitors === 0 && (
        <p className="mt-4 text-sm text-muted">
          No home page visits in this window.
        </p>
      )}

      {data && data.visitors > 0 && ordered.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          {data.visitors} visits, and nobody has scrolled far enough to be
          counted yet.
        </p>
      )}

      {data && ordered.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {ordered.map(({ label, row }) => (
            <li key={label}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.1em]">
                  {SECTION_LABELS[label] ?? label}
                </p>
                <p className="shrink-0 text-xs text-muted tabular-nums">
                  {row!.share}% · {row!.visitors} of {data.visitors}
                </p>
              </div>
              <div className="mt-1 h-2 bg-subtle">
                <div
                  className="h-full bg-foreground"
                  style={{ width: `${Math.max(1, row!.share)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PathList({ title, items }: { title: string; items: TrafficPage[] }) {
  const max = Math.max(1, items[0]?.views ?? 1);
  return (
    <section aria-label={title}>
      <p className={labelCls}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No data yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((page) => (
            <li key={page.path}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-xs font-bold">{page.path}</p>
                <p className="shrink-0 text-xs text-muted">
                  {page.views} views · {page.visitors} visitors
                </p>
              </div>
              <div
                className="mt-1 h-2 bg-foreground"
                style={{ width: `${Math.max(2, (page.views / max) * 100)}%` }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
