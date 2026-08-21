"use client";

import { useState } from "react";
import { subscribersApi } from "@/lib/api";
import type { Subscriber, SubscriberStatus } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import {
  btnGhostSm,
  btnSolid,
  chipCls,
  ErrorNote,
  Field,
  inputCls,
  labelCls,
  Loading,
  textareaCls,
} from "../ui";

/**
 * The drop list.
 *
 * Three numbers matter and they are the three shown: how many confirmed (the
 * asset), how many pending (people who signed up and never clicked, which is a
 * deliverability problem rather than an audience), and how many left.
 */

const FILTERS: { value: SubscriberStatus | "all"; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "unsubscribed", label: "Left" },
];

export function SubscribersTab() {
  const [filter, setFilter] = useState<SubscriberStatus | "all">("confirmed");
  const [note, setNote] = useState<string | null>(null);

  const { data: counts, reload: reloadCounts } = useAsync(
    () => subscribersApi.subscriberCounts(),
    [],
  );
  const { data, loading, error, reload } = useAsync(
    () =>
      subscribersApi.listSubscribers({
        pageSize: 50,
        ...(filter === "all" ? {} : { status: filter }),
      }),
    [filter],
  );

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-wrap gap-x-10 gap-y-4">
        <Stat label="Confirmed" value={counts?.confirmed} strong />
        <Stat label="Pending" value={counts?.pending} />
        <Stat label="Left" value={counts?.unsubscribed} />
      </section>

      <BroadcastToList
        confirmed={counts?.confirmed ?? 0}
        onSent={setNote}
      />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={labelCls}>The list ({data?.total ?? 0})</p>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((one) => (
              <button
                key={one.value}
                type="button"
                aria-pressed={filter === one.value}
                onClick={() => setFilter(one.value)}
                className={chipCls(filter === one.value)}
              >
                {one.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => downloadCsv(data?.items ?? [])}
              disabled={!data || data.items.length === 0}
              className={btnGhostSm}
            >
              Export CSV
            </button>
          </div>
        </div>

        <p aria-live="polite" className="min-h-4 text-xs text-muted">
          {note}
        </p>

        {loading && <Loading label="Loading subscribers" />}
        {error && <ErrorNote message={error} />}

        {data && data.items.length === 0 && (
          <p className="text-sm leading-7 text-muted">
            Nobody here yet.
          </p>
        )}

        {data && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-subtle text-left">
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th>Source</Th>
                  <Th>Joined</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} className="border-b border-subtle">
                    <td className="py-3 pr-4">{row.email}</td>
                    <td className="py-3 pr-4 text-[11px] uppercase tracking-[0.15em] text-muted">
                      {row.status}
                    </td>
                    <td className="py-3 pr-4 text-[11px] uppercase tracking-[0.15em] text-muted">
                      {row.source}
                    </td>
                    <td className="py-3 pr-4 text-muted tabular-nums">
                      {formatDate(row.confirmedAt ?? row.createdAt)}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            !confirm(
                              `Delete ${row.email} outright? Use this for a deletion request — an unsubscribe should stay on the list as a record that they asked to be left alone.`,
                            )
                          ) {
                            return;
                          }
                          try {
                            await subscribersApi.deleteSubscriber(row.id);
                            reload();
                            reloadCounts();
                          } catch (err) {
                            setNote(errorMessage(err));
                          }
                        }}
                        className={btnGhostSm}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="pb-2 pr-4 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
      {children}
    </th>
  );
}

function Stat({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number | undefined;
  strong?: boolean;
}) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <p
        className={`mt-1 tabular-nums ${
          strong ? "text-4xl" : "text-2xl text-muted"
        }`}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

/**
 * Sending to the list.
 *
 * Behind a typed confirmation because it is the one action here that cannot be
 * undone — the mail is either in a few hundred inboxes or it is not, and there
 * is no draft state between writing it and everyone reading it.
 */
function BroadcastToList({
  confirmed,
  onSent,
}: {
  confirmed: number;
  onSent: (note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState("");

  if (confirmed === 0) {
    return (
      <section className="border border-subtle p-4">
        <p className={labelCls}>Email the list</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Nobody has confirmed yet, so there is nobody to email. Pending
          subscribers never receive anything but their own confirmation.
        </p>
      </section>
    );
  }

  if (!open) {
    return (
      <section className="border border-subtle p-4">
        <p className={labelCls}>Email the list</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Goes to {confirmed} confirmed subscriber
          {confirmed === 1 ? "" : "s"}, with a one-click unsubscribe in the
          footer of every copy.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${btnGhostSm} mt-3`}
        >
          Write one
        </button>
      </section>
    );
  }

  return (
    <form
      className="flex max-w-xl flex-col gap-5 border border-foreground p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        try {
          const result = await subscribersApi.broadcastToList(
            String(data.get("title") ?? ""),
            String(data.get("body") ?? ""),
          );
          form.reset();
          setAck("");
          setOpen(false);
          onSent(
            `Sent to ${result.sent} subscriber${result.sent === 1 ? "" : "s"}${
              result.failed > 0 ? `, ${result.failed} failed` : ""
            }.`,
          );
        } catch (err) {
          onSent(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className={labelCls}>Email {confirmed} confirmed subscribers</p>

      <Field id="list-title" label="Subject">
        <input
          id="list-title"
          name="title"
          required
          maxLength={120}
          placeholder="Drop 02 lands Friday"
          className={inputCls}
        />
      </Field>
      <Field id="list-body" label="Message">
        <textarea
          id="list-body"
          name="body"
          required
          rows={6}
          maxLength={4000}
          placeholder="Blank line between paragraphs."
          className={textareaCls}
        />
      </Field>

      <Field
        id="list-ack"
        label={`Type SEND to confirm — this reaches ${confirmed} inboxes and cannot be taken back`}
      >
        <input
          id="list-ack"
          value={ack}
          onChange={(e) => setAck(e.target.value)}
          autoComplete="off"
          className={inputCls}
        />
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || ack.trim().toUpperCase() !== "SEND"}
          className={btnSolid}
        >
          {busy ? "Sending…" : "Send it"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={btnGhostSm}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * A CSV of what is on screen.
 *
 * Built and downloaded in the browser rather than as an endpoint: the rows are
 * already here, and an export route is one more place holding a list of email
 * addresses behind one more auth check.
 */
function downloadCsv(rows: Subscriber[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const csv = [
    "email,status,source,joined,confirmed",
    ...rows.map((row) =>
      [
        escape(row.email),
        row.status,
        escape(row.source),
        row.createdAt,
        row.confirmedAt ?? "",
      ].join(","),
    ),
  ].join("\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `stiff-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
