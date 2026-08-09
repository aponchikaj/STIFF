"use client";

import { useMemo, useState } from "react";
import { adminApi } from "@/lib/api";
import type { TimeseriesMetric } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import { chipCls, ErrorNote, labelCls, Loading } from "../ui";

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

  const tiles = [
    { label: "Total revenue", value: formatPrice(overview.totalRevenueCents) },
    { label: "Orders", value: String(overview.totalOrders) },
    { label: "Users", value: String(overview.totalUsers) },
    { label: "Products", value: String(overview.totalProducts) },
    {
      label: "Revenue this month",
      value: formatPrice(overview.revenueThisMonthCents),
    },
    { label: "Signups this month", value: String(overview.signupsThisMonth) },
    { label: "Open contacts", value: String(overview.pendingContacts) },
  ];

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

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

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

      <section aria-label="Monthly chart">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="flex size-9 items-center justify-center rounded-[2px] border border-subtle text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
            >
              ←
            </button>
            <p className="min-w-40 text-center text-sm font-bold uppercase tracking-[0.1em]">
              {MONTH_NAMES[month]} {year}
            </p>
            <button
              type="button"
              aria-label="Next month"
              disabled={isCurrentMonth}
              onClick={() => shiftMonth(1)}
              className="flex size-9 items-center justify-center rounded-[2px] border border-subtle text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:opacity-40"
            >
              →
            </button>
          </div>
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
        </div>

        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          {MONTH_NAMES[month]} total:{" "}
          <span className="text-foreground">
            {metric === "revenue" ? formatPrice(monthTotal) : monthTotal}
          </span>
        </p>

        {seriesLoading ? (
          <Loading label="Loading chart" />
        ) : (
          <div className="mt-6">
            <div className="flex h-44 items-end gap-px border-b border-subtle sm:gap-0.5">
              {days.map(({ day, value }) => (
                <div
                  key={day}
                  title={`${day} ${MONTH_NAMES[month]} — ${
                    metric === "revenue" ? formatPrice(value) : value
                  }`}
                  className="group relative flex-1"
                >
                  <div
                    className={`w-full transition-colors ${
                      value > 0
                        ? "bg-foreground group-hover:bg-muted"
                        : "bg-subtle"
                    }`}
                    style={{
                      height: `${value > 0 ? Math.max(4, (value / maxValue) * 176) : 2}px`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
              <span>1</span>
              <span>{Math.ceil(range.days / 2)}</span>
              <span>{range.days}</span>
            </div>
          </div>
        )}
      </section>

      {top && top.items.length > 0 && (
        <section aria-label="Top products">
          <p className={labelCls}>Top products — all time</p>
          <ul className="mt-4 flex flex-col gap-3">
            {top.items.map((item, i) => {
              const maxRev = Math.max(1, top.items[0]?.revenueCents ?? 1);
              return (
                <li key={`${item.productId}-${i}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-xs font-bold uppercase tracking-wide">
                      {i + 1}. {item.name}
                    </p>
                    <p className="shrink-0 text-xs text-muted">
                      {item.unitsSold} sold · {formatPrice(item.revenueCents)}
                    </p>
                  </div>
                  <div
                    className="mt-1 h-2 bg-foreground"
                    style={{
                      width: `${Math.max(2, (item.revenueCents / maxRev) * 100)}%`,
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
