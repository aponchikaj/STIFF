"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import type { TrafficPage } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  cardCls,
  chipCls,
  Empty,
  ErrorNote,
  Loading,
  Panel,
  Stat,
  tableCls,
  TableScroll,
  tdCls,
  theadCls,
  thCls,
  trCls,
} from "../ui";

const RANGES = [7, 30, 90] as const;

/* Capped so a week of traffic is a chart, not a wall. */
const CHART_HEIGHT = 240;

function dateKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const lastDays = `Last ${rangeDays} days`;

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}
      >
        <div className="p-5">
          <Stat
            label="Visitors today"
            value={data.summary.todayVisitors}
            hint="Since midnight"
          />
        </div>
        <div className="p-5">
          <Stat
            label="Views today"
            value={data.summary.todayViews}
            hint="Since midnight"
          />
        </div>
        <div className="p-5">
          <Stat
            label="Visitors in range"
            value={data.summary.rangeVisitors}
            hint={lastDays}
          />
        </div>
        <div className="p-5">
          <Stat
            label="Views in range"
            value={data.summary.rangeViews}
            hint={lastDays}
          />
        </div>
      </div>

      <Panel
        bleed
        eyebrow="Per day"
        title={metric === "visitors" ? "Visitors" : "Views"}
        aside={
          <>
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
          </>
        }
      >
        <div className="border-t border-line px-5 pb-5 pt-5">
          <div
            className="relative"
            style={{ height: `${CHART_HEIGHT}px` }}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Two gridlines and the baseline: enough to judge a height. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-line"
            />
            {hovered !== null && days[hovered] && (
              <div
                className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-control)] bg-ink px-2.5 py-1.5 text-card shadow-[var(--shadow-pop)]"
                style={{ left: `${((hovered + 0.5) / days.length) * 100}%` }}
              >
                <p className="tnum text-[11px] font-semibold">
                  {days[hovered].date}
                </p>
                <p className="tnum text-[11px] opacity-70">
                  Visitors: {days[hovered].visitors} · Views:{" "}
                  {days[hovered].views}
                </p>
              </div>
            )}
            <div className="flex h-full items-end gap-px border-b border-line-strong sm:gap-0.5">
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
                          ? "bg-ink"
                          : "bg-line"
                    }`}
                    style={{
                      height: `${day.value > 0 ? Math.max(4, (day.value / maxValue) * CHART_HEIGHT) : 2}px`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="tnum mt-2 flex justify-between text-[11px] text-faint">
            <span>{days[0]?.date.slice(5)}</span>
            <span>{days[days.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <PathList title="Top pages" items={data.topPages} />
        <PathList title="Top products by views" items={data.topProducts} />
      </div>
    </div>
  );
}

function PathList({ title, items }: { title: string; items: TrafficPage[] }) {
  const max = Math.max(1, items[0]?.views ?? 1);
  return (
    <Panel bleed title={title}>
      {items.length === 0 ? (
        <div className="border-t border-line">
          <Empty>Nothing recorded for this range yet.</Empty>
        </div>
      ) : (
        <TableScroll>
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr className="border-t border-line">
                <th className={thCls}>Path</th>
                <th className={`${thCls} text-right`}>Views</th>
                <th className={`${thCls} text-right`}>Visitors</th>
              </tr>
            </thead>
            <tbody>
              {items.map((page) => (
                <tr key={page.path} className={trCls}>
                  <td className={`${tdCls} w-full`}>
                    <p className="max-w-[280px] truncate text-ink">
                      {page.path}
                    </p>
                    <div className="mt-1.5 h-1 max-w-[280px] bg-line">
                      <div
                        className="h-full bg-ink"
                        style={{
                          width: `${Math.max(2, (page.views / max) * 100)}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td className={`${tdCls} tnum text-right`}>{page.views}</td>
                  <td className={`${tdCls} tnum text-right`}>
                    {page.visitors}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </Panel>
  );
}
