"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import {
  Badge,
  btnDanger,
  btnGhost,
  btnPrimarySm,
  chipCls,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Note,
  Panel,
  textareaCls,
} from "../ui";

const FILTERS = ["all", "open", "handled"] as const;

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
    <div className="flex flex-col gap-5">
      <Panel
        eyebrow="Inbox"
        title="Messages from the contact form"
        bleed
        aside={
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
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
        }
      >
        <div className="px-5 pb-3">
          {error && <ErrorNote message={error} />}
          <Note>{note}</Note>
        </div>

        {loading && (
          <div className="px-5">
            <Loading label="Loading messages" />
          </div>
        )}

        <ul>
          {data?.items.map((message) => (
            <li key={message.id} className="border-t border-line px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-ink">
                    {message.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] leading-5 text-faint">
                    {message.email} · {formatDate(message.createdAt)}
                  </p>
                </div>
                <Badge tone={message.isHandled ? "positive" : "caution"}>
                  {message.isHandled ? "Handled" : "Open"}
                </Badge>
              </div>

              {message.subject && (
                <p className="mt-2.5 text-[13px] font-semibold text-ink">
                  {message.subject}
                </p>
              )}
              <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-muted">
                {message.message}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setReplyingId((id) =>
                      id === message.id ? null : message.id,
                    );
                    setReplyText("");
                  }}
                  className={btnGhost}
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
                  className={btnGhost}
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
                  className={`${btnDanger} ml-auto`}
                >
                  Delete
                </button>
              </div>

              {replyingId === message.id && (
                <form
                  className="mt-3 rounded-[var(--radius-control)] border border-line bg-raised p-4"
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
                  <Field
                    id={`reply-${message.id}`}
                    label="Reply"
                    hint={`Emailed to ${message.email}.`}
                  >
                    <textarea
                      id={`reply-${message.id}`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={4}
                      maxLength={5000}
                      placeholder={`Reply to ${message.name}…`}
                      className={textareaCls}
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
                    className={`${btnPrimarySm} mt-3`}
                  >
                    {sending ? "Sending…" : "Send reply"}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {data && data.items.length === 0 && !loading && (
          <div className="border-t border-line">
            <Empty>No messages in this view.</Empty>
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
    </div>
  );
}
