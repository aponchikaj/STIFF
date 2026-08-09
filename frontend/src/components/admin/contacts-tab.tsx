"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { btnGhostSm, chipCls, ErrorNote, Loading } from "../ui";

export function ContactsTab() {
  const [filter, setFilter] = useState<"all" | "open" | "handled">("all");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
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
        {(["all", "open", "handled"] as const).map((f) => (
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
                onClick={() => {
                  setReplyingId((id) => (id === message.id ? null : message.id));
                  setReplyText("");
                }}
                className={btnGhostSm}
              >
                {replyingId === message.id ? "Cancel reply" : "Reply by email"}
              </button>
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
            {replyingId === message.id && (
              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!replyText.trim()) return;
                  setSending(true);
                  setNote(null);
                  try {
                    await adminApi.replyContact(message.id, replyText.trim());
                    setReplyingId(null);
                    setReplyText("");
                    setNote(`Reply emailed to ${message.email}.`);
                    reload();
                  } catch (err) {
                    setNote(errorMessage(err));
                  } finally {
                    setSending(false);
                  }
                }}
              >
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  maxLength={5000}
                  placeholder={`Reply to ${message.name}…`}
                  className="w-full rounded-[2px] border border-subtle bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-foreground focus-visible:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="flex h-10 items-center self-start rounded-[2px] bg-foreground px-5 text-[11px] font-bold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:opacity-40"
                >
                  {sending ? "Sending…" : "Send reply"}
                </button>
              </form>
            )}
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
