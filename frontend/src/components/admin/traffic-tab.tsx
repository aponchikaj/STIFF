"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import type { TrafficPage } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { chipCls, ErrorNote, labelCls, Loading } from "../ui";

const RANGES = [7, 30, 90] as const;

function dateKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TrafficTab() {
  const [rangeDays, setRangeDays] = useState<(typeof RANGES)[number]>(7);
  const [metric, setMetric] = useState<"views" | "visitors">("visitors");
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
          <div className="flex h-44 items-end gap-px border-b border-subtle sm:gap-0.5">
            {days.map((day) => (
              <div
                key={day.date}
                title={`${day.date} — ${day.visitors} visitors, ${day.views} views`}
                className="group relative flex-1"
              >
                <div
                  className={`w-full transition-colors ${
                    day.value > 0
                      ? "bg-foreground group-hover:bg-muted"
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

      <div className="grid gap-12 lg:grid-cols-2">
        <PathList title="Top pages" items={data.topPages} />
        <PathList title="Top products by views" items={data.topProducts} />
      </div>
    </div>
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
