"use client";

import { useEffect, useState } from "react";
import { auditApi } from "@/lib/api";
import type { AuditEntry } from "@/lib/api/audit";
import { formatDate } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import { btnGhostSm, chipCls, ErrorNote, inputCls, Loading } from "../ui";

const PAGE_SIZE = 20;

const METHODS = ["", "POST", "PUT", "PATCH", "DELETE"] as const;

const METHOD_LABEL: Record<string, string> = {
  "": "All",
  POST: "Created",
  PUT: "Replaced",
  PATCH: "Edited",
  DELETE: "Deleted",
};

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
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by path, e.g. orders"
          aria-label="Filter audit entries by path"
          className={`${inputCls} h-10 max-w-sm`}
        />
        <div className="flex gap-1.5">
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

      {loading && <Loading label="Loading trail" />}
      {error && <ErrorNote message={error} />}

      <ul className="mt-6 border-t border-subtle">
        {data?.items.map((entry) => (
          <Entry key={entry.id} entry={entry} />
        ))}
      </ul>

      {data && data.items.length === 0 && !loading && (
        <p className="py-8 text-sm text-muted">
          Nothing recorded yet. Entries appear here as changes are made.
        </p>
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className={btnGhostSm}
          >
            ← Prev
          </button>
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className={btnGhostSm}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function Entry({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const hasChanges =
    entry.changes !== null && Object.keys(entry.changes).length > 0;

  return (
    <li className="border-b border-subtle py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide">
          {METHOD_LABEL[entry.method] ?? entry.method}{" "}
          <span className="font-medium normal-case tracking-normal text-muted">
            {/* The /api prefix is on every row and tells nobody anything. */}
            {entry.path.replace(/^\/api/, "")}
          </span>
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
          {formatDate(entry.createdAt)} · {entry.statusCode}
        </p>
      </div>

      <p className="mt-1 text-xs text-muted">
        {entry.actorUsername} ({entry.actorEmail})
        {entry.actorId === null && " · account since deleted"}
        {entry.ip ? ` · ${entry.ip}` : ""}
        {entry.origin === "shop" && " · from a shop session"}
      </p>

      {hasChanges && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`${btnGhostSm} mt-2`}
          >
            {open ? "Hide detail" : "Show detail"}
          </button>
          {open && (
            <pre className="mt-2 overflow-x-auto rounded-[2px] border border-subtle bg-surface p-3 text-[11px] leading-5 text-muted">
              {JSON.stringify(entry.changes, null, 2)}
            </pre>
          )}
        </>
      )}
    </li>
  );
}
