"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { useSession } from "../providers";
import { btnGhostSm, ErrorNote, inputCls, Loading } from "../ui";

export function UsersTab() {
  const { user: me } = useSession();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(
    () =>
      adminApi.listUsers({
        search: query || undefined,
        page,
        pageSize: 15,
      }),
    [query, page],
  );
  const [note, setNote] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / 15));

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function act(action: () => Promise<unknown>) {
    setNote(null);
    try {
      await action();
      reload();
    } catch (err) {
      setNote(errorMessage(err));
    }
  }

  return (
    <div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search username or email"
        aria-label="Search users"
        className={`${inputCls} h-10 max-w-sm`}
      />
      {loading && <Loading label="Loading users" />}
      {error && <ErrorNote message={error} />}
      <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted">
        {note}
      </p>

      <ul className="mt-4 border-t border-subtle">
        {data?.items.map((u) => (
          <li key={u.id} className="border-b border-subtle py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide">
                {u.username}
                <span className="ml-2 font-medium text-muted">{u.email}</span>
              </p>
              <span className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-[2px] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] ${
                    u.role === "admin"
                      ? "bg-foreground text-background"
                      : "border border-subtle text-muted"
                  }`}
                >
                  {u.role}
                </span>
                {u.isBlocked && (
                  <span className="rounded-[2px] border border-foreground px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em]">
                    Blocked
                  </span>
                )}
                {!u.isVerified && (
                  <span className="rounded-[2px] border border-subtle px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-muted">
                    Unverified
                  </span>
                )}
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                  {u.ordersCount} orders · joined {formatDate(u.createdAt)}
                </span>
              </span>
            </div>
            {u.id !== me?.id && (
              <div className="mt-2 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() => act(() => adminApi.blockUser(u.id, !u.isBlocked))}
                  className={btnGhostSm}
                >
                  {u.isBlocked ? "Unblock" : "Block"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    act(() =>
                      adminApi.changeRole(
                        u.id,
                        u.role === "admin" ? "user" : "admin",
                      ),
                    )
                  }
                  className={btnGhostSm}
                >
                  {u.role === "admin" ? "Demote to user" : "Make admin"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete ${u.username} forever?`)) {
                      void act(() => adminApi.deleteUser(u.id));
                    }
                  }}
                  className={btnGhostSm}
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {data && data.items.length === 0 && !loading && (
        <p className="py-8 text-sm text-muted">No users match.</p>
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
