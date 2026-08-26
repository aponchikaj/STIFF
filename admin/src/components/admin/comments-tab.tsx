"use client";

import { useEffect, useState } from "react";
import { adminApi, commentsApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { btnGhostSm, ErrorNote, inputCls, Loading } from "../ui";

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
    <div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search comment text"
        aria-label="Search comments"
        className={`${inputCls} h-10 max-w-sm`}
      />
      {loading && <Loading label="Loading comments" />}
      {error && <ErrorNote message={error} />}
      <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted">
        {note}
      </p>

      <ul className="mt-4 border-t border-subtle">
        {data?.items.map((comment) => (
          <li key={comment.id} className="border-b border-subtle py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide">
                {comment.user.username}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                on {comment.targetType} · {formatDate(comment.createdAt)}
              </p>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">{comment.body}</p>
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
              className={`${btnGhostSm} mt-2`}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      {data && data.items.length === 0 && !loading && (
        <p className="py-8 text-sm text-muted">No comments found.</p>
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
