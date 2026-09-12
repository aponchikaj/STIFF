"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authApi, auditApi } from "@/lib/api";
import type { AuditEntry } from "@/lib/api/audit";
import { formatDate } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import {
  Badge,
  btnDanger,
  btnGhost,
  btnSecondary,
  chipCls,
  Empty,
  ErrorNote,
  inputCls,
  Loading,
  Note,
  Panel,
  tableCls,
  TableScroll,
  tdCls,
  thCls,
  theadCls,
  trCls,
} from "../ui";

const PAGE_SIZE = 20;

const METHODS = ["", "POST", "PUT", "PATCH", "DELETE"] as const;

const METHOD_LABEL: Record<string, string> = {
  "": "All",
  POST: "Created",
  PUT: "Replaced",
  PATCH: "Edited",
  DELETE: "Deleted",
};

/** A write is worth noticing; a deletion is worth noticing more. */
function methodTone(method: string) {
  if (method === "DELETE") return "danger" as const;
  if (method === "POST") return "info" as const;
  return "caution" as const;
}

function statusTone(code: number) {
  if (code >= 400) return "danger" as const;
  if (code >= 300) return "caution" as const;
  return "neutral" as const;
}

/**
 * The trail of every change an admin has made.
 *
 * Read-only, and there is no endpoint behind it that would edit or remove an
 * entry — a record an admin can rewrite is not one.
 */
export function AuditTab() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, loading, error } = useAsync(
    () =>
      auditApi.listAudit({
        path: query || undefined,
        method: method || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [query, method, page],
  );

  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="flex flex-col gap-5">
      <Panel
        eyebrow="Append-only"
        title="Every change an admin has made"
        bleed
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by path, e.g. orders"
              aria-label="Filter audit entries by path"
              className={`${inputCls} max-w-[220px]`}
            />
            <div className="flex flex-wrap gap-1.5">
              {METHODS.map((value) => (
                <button
                  key={value || "all"}
                  type="button"
                  onClick={() => {
                    setMethod(value);
                    setPage(1);
                  }}
                  aria-pressed={method === value}
                  className={chipCls(method === value)}
                >
                  {METHOD_LABEL[value]}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {error && (
          <div className="px-5 pb-2">
            <ErrorNote message={error} />
          </div>
        )}
        {loading && (
          <div className="px-5">
            <Loading label="Loading trail" />
          </div>
        )}

        {data && data.items.length > 0 && (
          <TableScroll>
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th className={thCls}>When</th>
                  <th className={thCls}>Who</th>
                  <th className={thCls}>Action</th>
                  <th className={thCls}>Path</th>
                  <th className={thCls}>Status</th>
                  <th className={`${thCls} text-right`}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <Entry key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}

        {data && data.items.length === 0 && !loading && (
          <div className="border-t border-line">
            <Empty>
              Nothing recorded yet. Entries appear here as changes are made.
            </Empty>
          </div>
        )}

        {pageCount > 1 && (
          <div className="flex items-center gap-4 border-t border-line px-5 py-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className={btnGhost}
            >
              ← Prev
            </button>
            <span className="tnum text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              className={btnGhost}
            >
              Next →
            </button>
          </div>
        )}
      </Panel>

      <Sessions />
    </div>
  );
}

/**
 * The lever you reach for when something in the trail above looks wrong.
 *
 * Lives here rather than in the header because it belongs next to the evidence
 * — and because it is not a button anyone should press by accident while
 * aiming for "Log out".
 */
function Sessions() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function endAll() {
    setBusy(true);
    setNote(null);
    try {
      await authApi.logoutEverywhere();
      router.replace("/login");
    } catch (err) {
      setNote(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Panel eyebrow="This account" title="Sessions" className="max-w-2xl">
      <p className="max-w-prose text-[13px] leading-6 text-muted">
        Ends every admin session for this account, on every device, including
        this one. The shop account is untouched — you stay signed in at the
        storefront.
      </p>

      {confirming ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={endAll}
            disabled={busy}
            className={btnDanger}
          >
            {busy ? "Ending…" : "Yes, end them all"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className={btnGhost}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`${btnSecondary} mt-4`}
        >
          Sign out everywhere
        </button>
      )}

      <div className="mt-3">
        <Note>{note}</Note>
      </div>
    </Panel>
  );
}

function Entry({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const hasChanges =
    entry.changes !== null && Object.keys(entry.changes).length > 0;
  // The /api prefix is on every row and tells nobody anything.
  const path = entry.path.replace(/^\/api/, "");

  return (
    <>
      <tr className={trCls}>
        <td className={`${tdCls} whitespace-nowrap`}>
          <span className="tnum text-[12px] text-ink">
            {formatDate(entry.createdAt)}
          </span>
          {entry.ip && (
            <span className="mt-0.5 block font-mono text-[11px] text-faint">
              {entry.ip}
            </span>
          )}
        </td>
        <td className={tdCls}>
          <span className="block max-w-[180px] truncate text-[13px] font-semibold text-ink">
            {entry.actorUsername}
          </span>
          <span
            className="mt-0.5 block max-w-[180px] truncate font-mono text-[11px] text-faint"
            title={entry.actorEmail}
          >
            {entry.actorEmail}
          </span>
          {(entry.actorId === null || entry.origin === "shop") && (
            <span className="mt-0.5 block text-[11px] text-faint">
              {entry.actorId === null && "Account since deleted"}
              {entry.actorId === null && entry.origin === "shop" && " · "}
              {entry.origin === "shop" && "From a shop session"}
            </span>
          )}
        </td>
        <td className={tdCls}>
          <Badge tone={methodTone(entry.method)}>
            {METHOD_LABEL[entry.method] ?? entry.method}
          </Badge>
        </td>
        <td className={tdCls}>
          <span
            className="block max-w-[320px] truncate font-mono text-[12px] text-ink"
            title={path}
          >
            {path}
          </span>
        </td>
        <td className={tdCls}>
          <Badge tone={statusTone(entry.statusCode)}>
            <span className="tnum">{entry.statusCode}</span>
          </Badge>
        </td>
        <td className={`${tdCls} text-right`}>
          {hasChanges ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={btnGhost}
            >
              {open ? "Hide" : "Show"}
            </button>
          ) : (
            <span className="text-[11px] text-faint">—</span>
          )}
        </td>
      </tr>
      {hasChanges && open && (
        <tr className="border-t border-line">
          <td colSpan={6} className="px-5 pb-4">
            <pre className="overflow-x-auto rounded-[var(--radius-control)] border border-line bg-raised p-3 font-mono text-[11px] leading-5 text-muted">
              {JSON.stringify(entry.changes, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
