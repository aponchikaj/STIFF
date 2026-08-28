"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveChart,
  archiveChart,
  gameCharts,
  gameEconomy,
  gameOverview,
  gameRejections,
  reviewRejection,
  type AdminChart,
  type AdminRejection,
  type GameOverview,
} from "@/lib/api/game";
import {
  btnGhostSm,
  btnSolidSm,
  chipCls,
  ErrorNote,
  eyebrowCls,
  Loading,
} from "@/components/ui";

type View = "overview" | "charts" | "anticheat" | "economy";

/**
 * The game's operations, in the panel.
 *
 * Deliberately not a chart *editor* — that is the largest single piece of this
 * phase and belongs on its own, after the operational surface exists. What is
 * here is what someone needs on a normal day: what the numbers are, what is
 * waiting to be published, what got flagged, and what the payouts are set to.
 */
export function GameTab() {
  const [view, setView] = useState<View>("overview");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "Overview"],
            ["charts", "Charts"],
            ["anticheat", "Anti-cheat"],
            ["economy", "Economy"],
          ] as [View, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={chipCls(view === key)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "overview" ? <Overview /> : null}
      {view === "charts" ? <Charts /> : null}
      {view === "anticheat" ? <AntiCheat /> : null}
      {view === "economy" ? <Economy /> : null}
    </div>
  );
}

/** Loads once on mount, keeps its own error, and never throws at the tab. */
function useLoaded<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setData(await load());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    }
    // `load` is recreated each render by callers that close over nothing, so
    // depending on it would refetch forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, refresh };
}

function Overview() {
  const { data, error } = useLoaded<GameOverview>(gameOverview);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading label="Loading game overview" />;

  const stats: [string, string][] = [
    ["Songs", String(data.songs)],
    ["Charts", `${data.approvedCharts} live / ${data.charts}`],
    ["Runs", data.runs.toLocaleString()],
    ["Flagged", `${data.pendingReview} pending / ${data.rejections}`],
    ["Coins minted", data.coinsMinted.toLocaleString()],
    ["Coins spent", Math.abs(data.coinsSpent).toLocaleString()],
  ];

  return (
    <dl className="grid grid-cols-2 gap-px border border-subtle bg-subtle sm:grid-cols-3">
      {stats.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1 bg-background p-4">
          <dt className={eyebrowCls}>{label}</dt>
          <dd className="font-display text-2xl tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Charts() {
  const { data, error, refresh } = useLoaded<AdminChart[]>(gameCharts);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (id: string, fn: (id: string) => Promise<unknown>) => {
    setBusy(id);
    setActionError(null);
    try {
      await fn(id);
      await refresh();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Action failed",
      );
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading label="Loading charts" />;
  if (data.length === 0) {
    return <p className="text-sm text-muted">No charts yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {actionError ? <ErrorNote message={actionError} /> : null}

      <div className="overflow-x-auto border border-subtle">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-subtle text-left">
              <th className={`${eyebrowCls} p-3`}>Song</th>
              <th className={`${eyebrowCls} p-3`}>Difficulty</th>
              <th className={`${eyebrowCls} p-3`}>Notes</th>
              <th className={`${eyebrowCls} p-3`}>Peak NPS</th>
              <th className={`${eyebrowCls} p-3`}>Source</th>
              <th className={`${eyebrowCls} p-3`}>Status</th>
              <th className={`${eyebrowCls} p-3`} />
            </tr>
          </thead>
          <tbody>
            {data.map((chart) => (
              <tr key={chart.id} className="border-b border-subtle last:border-0">
                <td className="p-3">{chart.songTitle ?? chart.songId}</td>
                <td className="p-3 uppercase">{chart.difficulty}</td>
                <td className="p-3 tabular-nums">{chart.noteCount}</td>
                <td className="p-3 tabular-nums">{chart.npsPeak}</td>
                <td className="p-3">
                  {chart.generatedBy}
                  {chart.generatorModel ? ` · ${chart.generatorModel}` : ""}
                </td>
                <td className="p-3 uppercase">{chart.status}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    {chart.status !== "approved" ? (
                      <button
                        type="button"
                        disabled={busy === chart.id}
                        onClick={() => void act(chart.id, approveChart)}
                        className={btnSolidSm}
                      >
                        Approve
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy === chart.id}
                        onClick={() => void act(chart.id, archiveChart)}
                        className={btnGhostSm}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Approving re-hashes the chart and archives whichever version of the same
        song and difficulty was live — a chart&apos;s hash is what every future
        run is validated against, so it is recomputed rather than trusted.
      </p>
    </div>
  );
}

function AntiCheat() {
  const { data, error, refresh } = useLoaded<AdminRejection[]>(() =>
    gameRejections(false),
  );
  const [busy, setBusy] = useState<string | null>(null);

  const review = async (
    id: string,
    action: "dismissed" | "voided" | "suspended",
  ) => {
    setBusy(id);
    try {
      await reviewRejection(id, action);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading label="Loading flagged runs" />;
  if (data.length === 0) {
    return <p className="text-sm text-muted">Nothing waiting for review.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((row) => (
        <article
          key={row.id}
          className="flex flex-col gap-3 border border-subtle p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-lg uppercase">
              {row.reason.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-muted">
              {row.username ?? row.userId} ·{" "}
              {new Date(row.createdAt).toLocaleString()}
            </span>
          </div>

          {row.songTitle ? (
            <span className="text-sm text-muted">
              {row.songTitle} · {row.difficulty}
            </span>
          ) : null}

          {/* The evidence the check saw, verbatim — a reviewer deciding
              someone's run was illegitimate should see the numbers. */}
          <pre className="overflow-x-auto bg-surface p-3 text-xs">
            {JSON.stringify(row.detail, null, 2)}
          </pre>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === row.id}
              onClick={() => void review(row.id, "dismissed")}
              className={btnGhostSm}
            >
              Dismiss
            </button>
            <button
              type="button"
              disabled={busy === row.id}
              onClick={() => void review(row.id, "voided")}
              className={btnSolidSm}
            >
              Void
            </button>
            <button
              type="button"
              disabled={busy === row.id}
              onClick={() => void review(row.id, "suspended")}
              className={btnGhostSm}
            >
              Suspend player
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Economy() {
  const { data, error } = useLoaded<Record<string, unknown>>(gameEconomy);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading label="Loading economy" />;

  const keys = Object.keys(data);
  if (keys.length === 0) {
    return <p className="text-sm text-muted">No economy config rows yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {keys.map((key) => (
        <div key={key} className="flex flex-col gap-2 border border-subtle p-4">
          <span className={eyebrowCls}>{key}</span>
          <pre className="overflow-x-auto bg-surface p-3 text-xs">
            {JSON.stringify(data[key], null, 2)}
          </pre>
        </div>
      ))}
      {/* STUB: read-only. Editing these changes how much currency exists, so
          it wants a typed form per key rather than a JSON textarea that can
          save a shape the payout code will not understand. */}
      <p className="text-xs text-muted">
        Read-only for now. Editing needs a typed form per key — a free-text JSON
        field here could save a shape the payout code cannot read, and the first
        anyone would know is players earning nothing.
      </p>
    </div>
  );
}
