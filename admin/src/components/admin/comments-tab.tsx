"use client";

import { useEffect, useState } from "react";
import { adminApi, commentsApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import {
  btnGhost,
  btnSecondarySm,
  Empty,
  ErrorNote,
  inputCls,
  Loading,
  Note,
  Panel,
} from "../ui";

export function CommentsTab() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(
    () =>
      adminApi.listAllComments({
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

  return (
    <div className="flex flex-col gap-5">
      <Panel
        eyebrow={data ? `${data.total} in total` : undefined}
        title="Everything people have written"
        bleed
        aside={
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search comment text"
            aria-label="Search comments"
            className={`${inputCls} w-56 sm:w-64`}
          />
        }
      >
        <div className="border-t border-line px-5 py-3">
          <Note>{note}</Note>
        </div>

        {loading && (
          <div className="px-5">
            <Loading label="Loading comments" />
          </div>
        )}
        {error && (
          <div className="px-5 pb-2">
            <ErrorNote message={error} />
          </div>
        )}

        {data && data.items.length === 0 && !loading && (
          <Empty>No comments match that search.</Empty>
        )}

        <ul>
          {data?.items.map((comment) => (
            <li
              key={comment.id}
              className="flex items-start justify-between gap-4 border-t border-line px-5 py-3 transition-colors hover:bg-raised"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-[13px] font-bold text-ink">
                    {comment.user.username}
                  </p>
                  <p className="text-[11px] text-faint">
                    on {comment.targetType} · {formatDate(comment.createdAt)}
                  </p>
                </div>
                <p className="mt-1 text-[13px] leading-6 text-ink">
                  {comment.body}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setNote(null);
                  try {
                    await commentsApi.deleteComment(comment.id);
                    reload();
                  } catch (err) {
                    setNote(errorMessage(err));
                  }
                }}
                className={`${btnGhost} shrink-0 hover:text-danger`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

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
