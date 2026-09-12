"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { useSession } from "../providers";
import {
  Badge,
  btnGhost,
  btnSecondarySm,
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
    <div className="flex flex-col gap-5">
      <Panel
        eyebrow={
          data ? `${data.total} account${data.total === 1 ? "" : "s"}` : undefined
        }
        title="Everyone with an account"
        bleed
        aside={
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username or email"
            aria-label="Search users"
            className={`${inputCls} w-56 sm:w-64`}
          />
        }
      >
        <div className="border-t border-line px-5 py-3">
          <Note>{note}</Note>
        </div>

        {loading && (
          <div className="px-5">
            <Loading label="Loading users" />
          </div>
        )}
        {error && (
          <div className="px-5 pb-2">
            <ErrorNote message={error} />
          </div>
        )}

        {data && data.items.length === 0 && !loading && (
          <Empty>No users match that search.</Empty>
        )}

        {data && data.items.length > 0 && (
          <TableScroll>
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th scope="col" className={thCls}>
                    User
                  </th>
                  <th scope="col" className={thCls}>
                    Standing
                  </th>
                  <th scope="col" className={`${thCls} text-right`}>
                    Orders
                  </th>
                  <th scope="col" className={thCls}>
                    Joined
                  </th>
                  <th scope="col" className={`${thCls} text-right`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className={trCls}>
                    <td className={tdCls}>
                      <p className="font-bold text-ink">{u.username}</p>
                      <p className="text-[11px] text-faint">{u.email}</p>
                    </td>
                    <td className={tdCls}>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={u.role === "admin" ? "solid" : "neutral"}>
                          {u.role}
                        </Badge>
                        {u.isBlocked && <Badge tone="danger">Blocked</Badge>}
                        {!u.isVerified && (
                          <Badge tone="caution">Unverified</Badge>
                        )}
                      </span>
                    </td>
                    <td className={`${tdCls} tnum text-right`}>
                      {u.ordersCount}
                    </td>
                    <td className={`${tdCls} tnum text-muted`}>
                      {formatDate(u.createdAt)}
                    </td>
                    <td className={`${tdCls} text-right`}>
                      {u.id !== me?.id && (
                        <span className="flex flex-wrap justify-end gap-x-4 gap-y-1">
                          <button
                            type="button"
                            onClick={() =>
                              act(() => adminApi.blockUser(u.id, !u.isBlocked))
                            }
                            className={btnGhost}
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
                            className={btnGhost}
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
                            className={`${btnGhost} hover:text-danger`}
                          >
                            Delete
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className={btnSecondarySm}
            >
              Prev
            </button>
            <span className="tnum text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              className={btnSecondarySm}
            >
              Next
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
