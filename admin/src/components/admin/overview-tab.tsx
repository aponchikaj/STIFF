"use client";

import { useMemo, useState } from "react";
import { adminApi } from "@/lib/api";
import type { TimeseriesMetric } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import {
  btnIcon,
  cardCls,
  chipCls,
  ErrorNote,
  labelCls,
  Loading,
  Panel,
  Stat,
} from "../ui";

const METRICS: { key: TimeseriesMetric; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "orders", label: "Orders" },
  { key: "signups", label: "Signups" },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* Tall enough to read a month of daily bars, short enough that a quiet month
   is not a card full of nothing. */
const CHART_HEIGHT = 240;

const navBtn = `${btnIcon} disabled:cursor-not-allowed disabled:opacity-40`;

function key(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthRange(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0); // last day of month
  return { from: key(from), to: key(to), days: to.getDate() };
}

export function OverviewTab() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [metric, setMetric] = useState<TimeseriesMetric>("revenue");
  const [hovered, setHovered] = useState<number | null>(null);

  const { data: overview, loading, error } = useAsync(
    () => adminApi.getOverview(),
    [],
  );
  const range = monthRange(year, month);
  const { data: series, loading: seriesLoading } = useAsync(
    () =>
      adminApi.getTimeseries({ from: range.from, to: range.to, metric }),
    [range.from, range.to, metric],
  );
  const { data: top } = useAsync(() => adminApi.getTopProducts(5), []);

  if (loading) return <Loading label="Loading analytics" />;
  if (error) return <ErrorNote message={error} />;
  if (!overview) return null;

  // One value per day of the selected month.
  const byDate = new Map(series?.points.map((p) => [p.date, p.value]) ?? []);
  const days = Array.from({ length: range.days }, (_, i) => {
    const date = `${range.from.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
    return { day: i + 1, value: byDate.get(date) ?? 0 };
  });
  const maxValue = Math.max(1, ...days.map((d) => d.value));
  const monthTotal = days.reduce((sum, d) => sum + d.value, 0);
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();
  const thisMonth = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  return (
    <div className="flex flex-col gap-5">
      {/* The four that describe the shop, then the three that describe now. */}
      <div
        className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}
      >
        <div className="p-5">
          <Stat
            label="Total revenue"
            value={formatPrice(overview.totalRevenueCents)}
          />
        </div>
        <div className="p-5">
          <Stat label="Orders" value={overview.totalOrders} />
        </div>
        <div className="p-5">
          <Stat label="Users" value={overview.totalUsers} />
        </div>
        <div className="p-5">
          <Stat label="Products" value={overview.totalProducts} />
        </div>
      </div>

      <div
        className={`${cardCls} grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0`}
      >
        <div className="p-5">
          <Stat
            label="Revenue this month"
            value={formatPrice(overview.revenueThisMonthCents)}
            hint={thisMonth}
          />
        </div>
        <div className="p-5">
          <Stat
            label="Signups this month"
            value={overview.signupsThisMonth}
            hint={thisMonth}
          />
        </div>
        <div className="p-5">
          <Stat
            label="Open contacts"
            value={overview.pendingContacts}
            hint="Waiting on a reply"
            tone={overview.pendingContacts > 0 ? "caution" : undefined}
          />
        </div>
      </div>

      <Panel
        bleed
        eyebrow="Per day"
        title={`${MONTH_NAMES[month]} ${year}`}
        aside={
          <>
            <div className="flex gap-1.5">
              {METRICS.map(({ key: k, label }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMetric(k)}
                  className={chipCls(metric === k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                className={navBtn}
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Next month"
                disabled={isCurrentMonth}
                onClick={() => shiftMonth(1)}
                className={navBtn}
              >
                →
              </button>
            </div>
          </>
        }
      >
        <div className="flex items-baseline gap-2 border-t border-line px-5 py-3">
          <span className={labelCls}>Month total</span>
          <span className="tnum font-display text-[15px] text-ink">
            {metric === "revenue" ? formatPrice(monthTotal) : monthTotal}
          </span>
        </div>

        {seriesLoading ? (
          <div className="px-5 pb-5">
            <Loading label="Loading chart" />
          </div>
        ) : (
          <div className="px-5 pb-5 pt-5">
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
                  style={{
                    left: `${((hovered + 0.5) / days.length) * 100}%`,
                  }}
                >
                  <p className="text-[11px] font-semibold">
                    {days[hovered].day} {MONTH_NAMES[month]} {year}
                  </p>
                  <p className="tnum text-[11px] opacity-70">
                    {metric === "revenue"
                      ? `Revenue: ${formatPrice(days[hovered].value)}`
                      : `${metric === "orders" ? "Orders" : "Signups"}: ${days[hovered].value}`}
                  </p>
                </div>
              )}
              <div className="flex h-full items-end gap-px border-b border-line-strong sm:gap-0.5">
                {days.map(({ day, value }, i) => (
                  <div
                    key={day}
                    onMouseEnter={() => setHovered(i)}
                    className="group relative flex-1 cursor-crosshair"
                  >
                    <div
                      className={`w-full transition-colors ${
                        hovered === i
                          ? "bg-muted"
                          : value > 0
                            ? "bg-ink"
                            : "bg-line"
                      }`}
                      style={{
                        height: `${value > 0 ? Math.max(4, (value / maxValue) * CHART_HEIGHT) : 2}px`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="tnum mt-2 flex justify-between text-[11px] text-faint">
              <span>1</span>
              <span>{Math.ceil(range.days / 2)}</span>
              <span>{range.days}</span>
            </div>
          </div>
        )}
      </Panel>

      {top && top.items.length > 0 && (
        <Panel bleed eyebrow="All time" title="Top products">
          <ul>
            {top.items.map((item, i) => {
              const maxRev = Math.max(1, top.items[0]?.revenueCents ?? 1);
              return (
                <li
                  key={`${item.productId}-${i}`}
                  className="border-t border-line px-5 py-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-[13px] font-semibold text-ink">
                      <span className="tnum mr-2 text-faint">{i + 1}</span>
                      {item.name}
                    </p>
                    <p className="tnum shrink-0 text-[11px] text-faint">
                      {item.unitsSold} sold · {formatPrice(item.revenueCents)}
                    </p>
                  </div>
                  <div className="mt-2 h-1 bg-line">
                    <div
                      className="h-full bg-ink"
                      style={{
                        width: `${Math.max(2, (item.revenueCents / maxRev) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
