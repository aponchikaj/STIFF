"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { btnGhostSm, chipCls, ErrorNote, Loading } from "../ui";

export function ContactsTab() {
  const [filter, setFilter] = useState<"all" | "open" | "handled">("open");
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(
    () =>
      adminApi.listContacts({
        handled: filter === "all" ? undefined : filter === "handled",
        page,
        pageSize: 10,
      }),
    [filter, page],
  );
  const [note, setNote] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / 10));

  return (
    <div>
      <div className="flex gap-1.5">
        {(["open", "handled", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            className={chipCls(filter === f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <Loading label="Loading messages" />}
      {error && <ErrorNote message={error} />}
      <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted">
        {note}
      </p>

      <ul className="mt-4 border-t border-subtle">
        {data?.items.map((message) => (
          <li key={message.id} className="border-b border-subtle py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide">
                {message.name}
                <span className="ml-2 font-medium normal-case text-muted">
                  {message.email}
                </span>
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                {formatDate(message.createdAt)}
                {message.isHandled ? " · handled" : ""}
              </p>
            </div>
            {message.subject && (
              <p className="mt-1 text-xs font-bold">{message.subject}</p>
            )}
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted">
              {message.message}
            </p>
            <div className="mt-2 flex gap-4">
              <button
                type="button"
                onClick={async () => {
                  setNote(null);
                  try {
                    await adminApi.setContactHandled(
                      message.id,
                      !message.isHandled,
                    );
                    reload();
                  } catch (err) {
                    setNote(errorMessage(err));
                  }
                }}
                className={btnGhostSm}
              >
                {message.isHandled ? "Reopen" : "Mark handled"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setNote(null);
                  try {
                    await adminApi.deleteContact(message.id);
                    reload();
                  } catch (err) {
                    setNote(errorMessage(err));
                  }
                }}
                className={btnGhostSm}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      {data && data.items.length === 0 && !loading && (
        <p className="py-8 text-sm text-muted">No messages in this view.</p>
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
