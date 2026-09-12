"use client";

import { useState } from "react";
import { gameApi } from "@/lib/api";
import type {
  AdminReportView,
  ClosingStatus,
  ReportAction,
  ReportDetail,
  ReportPriority,
  ReportStatus,
  ReportTargetType,
} from "@/lib/api";
import { REPORT_TARGET_TYPES } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { useSession } from "../providers";
import {
  btnGhostSm,
  btnOutline,
  btnSolidSm,
  chipCls,
  ErrorNote,
  Field,
  labelCls,
  Loading,
  selectCls,
  textareaCls,
} from "../ui";
import {
  ConfirmButton,
  Empty,
  Facts,
  Note,
  Pill,
  SectionTitle,
  Stat,
  durationWords,
  formatDateTime,
  shortId,
  timeAgo,
  useAction,
  words,
} from "./game-ui";

/** `queue` is the working set; the rest are the archive views. */
type StatusFilter = ReportStatus | "queue" | "closed" | "all";

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "queue", label: "Queue" },
  { value: "open", label: "Open" },
  { value: "reviewing", label: "Reviewing" },
  { value: "closed", label: "Closed" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "all", label: "All" },
];

const PAGE_SIZE = 50;

/** P3 is a person possibly at risk; it should never sit behind P0 tidying. */
function priorityTone(p: ReportPriority) {
  return p === 3 ? "warn" : p === 2 ? "solid" : p === 1 ? "outline" : "neutral";
}

function statusTone(status: ReportStatus) {
  return status === "open"
    ? "outline"
    : status === "reviewing"
      ? "solid"
      : "neutral";
}

export function ReportsTab() {
  const [status, setStatus] = useState<StatusFilter>("queue");
  const [targetType, setTargetType] = useState<"all" | ReportTargetType>("all");
  const [minPriority, setMinPriority] = useState<"" | "1" | "2" | "3">("");
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useAsync(() => gameApi.getReportStats(), []);
  const list = useAsync(
    () =>
      gameApi.listReports({
        status,
        targetType: targetType === "all" ? undefined : targetType,
        minPriority: minPriority
          ? (Number(minPriority) as ReportPriority)
          : undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    [status, targetType, minPriority, offset],
  );

  const total = list.data?.total ?? 0;
  const items = list.data?.items ?? [];
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + PAGE_SIZE, total);

  function refilter(change: () => void) {
    change();
    setOffset(0);
    setOpenId(null);
  }

  const openCount =
    (stats.data?.byStatus.open ?? 0) + (stats.data?.byStatus.reviewing ?? 0);

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat
          label="Open"
          value={stats.data ? openCount : "…"}
          hint={
            stats.data
              ? `${stats.data.byStatus.reviewing} being looked at`
              : undefined
          }
        />
        <Stat
          label="By priority"
          value={
            stats.data
              ? `${stats.data.openByPriority["3"]} / ${stats.data.openByPriority["2"]}`
              : "…"
          }
          hint={
            stats.data
              ? `P3 / P2 · P1 ${stats.data.openByPriority["1"]} · P0 ${stats.data.openByPriority["0"]}`
              : undefined
          }
        />
        <Stat
          label="Oldest open"
          value={
            stats.data?.oldestOpenSeconds != null
              ? durationWords(stats.data.oldestOpenSeconds)
              : "—"
          }
          hint="waiting for a person"
        />
        <Stat
          label="Auto-hidden"
          value={
            stats.data
              ? stats.data.hidden.attempts + stats.data.hidden.comments
              : "…"
          }
          hint={
            stats.data
              ? `${stats.data.hidden.attempts} hand-ins · ${stats.data.hidden.comments} comments`
              : undefined
          }
        />
      </div>

      {stats.data && stats.data.mostReported.length > 0 && (
        <section>
          <SectionTitle>Most reported</SectionTitle>
          <ul className="border-t border-subtle">
            {stats.data.mostReported.map((row) => (
              <li
                key={`${row.targetType}-${row.targetId}`}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-subtle py-2.5 text-xs"
              >
                <span className="flex flex-wrap items-baseline gap-2">
                  <Pill>{words(row.targetType)}</Pill>
                  <span className="font-bold uppercase tracking-wide">
                    {row.about}
                  </span>
                </span>
                <span className="tabular-nums text-muted">
                  {row.reporters} different reporters
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle
          aside={
            <span className="text-[11px] uppercase tracking-[0.15em] text-muted">
              {total === 0 ? "nothing" : `${first}–${last} of ${total}`}
            </span>
          }
        >
          Reports
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => refilter(() => setStatus(chip.value))}
              className={chipCls(status === chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="report-target" className={labelCls}>
              About
            </label>
            <select
              id="report-target"
              value={targetType}
              onChange={(e) =>
                refilter(() =>
                  setTargetType(e.target.value as "all" | ReportTargetType),
                )
              }
              className={selectCls}
            >
              <option value="all">Anything</option>
              {REPORT_TARGET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {words(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="report-priority" className={labelCls}>
              Priority
            </label>
            <select
              id="report-priority"
              value={minPriority}
              onChange={(e) =>
                refilter(() =>
                  setMinPriority(e.target.value as "" | "1" | "2" | "3"),
                )
              }
              className={selectCls}
            >
              <option value="">Any</option>
              <option value="1">1 and up</option>
              <option value="2">2 and up</option>
              <option value="3">3 only</option>
            </select>
          </div>
        </div>

        {list.loading && <Loading label="Loading reports" />}
        {list.error && <ErrorNote message={list.error} />}
        {list.data && items.length === 0 && !list.loading && (
          <Empty>Nothing in the queue.</Empty>
        )}

        <ul className="mt-4 border-t border-subtle">
          {items.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              open={openId === report.id}
              onToggle={() =>
                setOpenId(openId === report.id ? null : report.id)
              }
              onChanged={() => {
                list.reload();
                stats.reload();
              }}
            />
          ))}
        </ul>

        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => {
                setOffset(Math.max(offset - PAGE_SIZE, 0));
                setOpenId(null);
              }}
              className={btnOutline}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={last >= total}
              onClick={() => {
                setOffset(offset + PAGE_SIZE);
                setOpenId(null);
              }}
              className={btnOutline}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ReportRow({
  report,
  open,
  onToggle,
  onChanged,
}: {
  report: AdminReportView;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const { user } = useSession();
  const mine = report.assignedTo && report.assignedTo === user?.id;

  return (
    <li className="border-b border-subtle py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="flex flex-wrap items-baseline gap-2">
          <Pill tone={priorityTone(report.priority)}>P{report.priority}</Pill>
          <Pill>{words(report.targetType)}</Pill>
          <span className="text-xs font-bold uppercase tracking-wide">
            {report.about}
          </span>
          <span className="text-xs text-muted">{report.reasonLabel}</span>
          {report.tags.map((tag) => (
            <Pill key={tag}>{words(tag)}</Pill>
          ))}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
          <Pill tone={statusTone(report.status)}>{report.status}</Pill>
          {report.assignedTo && (
            <span>{mine ? "assigned to you" : `held by ${shortId(report.assignedTo)}`}</span>
          )}
          <span>by {report.reporterHandle}</span>
          <span>{timeAgo(report.createdAt)}</span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className={btnGhostSm}
          >
            {open ? "Close" : "Open"}
          </button>
        </span>
      </div>
      {open && <ReportPane id={report.id} onChanged={onChanged} />}
    </li>
  );
}

function ReportPane({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => void;
}) {
  const { user: admin } = useSession();
  const detail = useAsync(() => gameApi.getReport(id), [id]);
  const { note, busy, act } = useAction(() => {
    detail.reload();
    onChanged();
  });

  if (detail.loading) return <Loading label="Loading the report" />;
  if (detail.error) return <ErrorNote message={detail.error} />;
  if (!detail.data) return null;

  const d: ReportDetail = detail.data;
  const r = d.report;
  const closed = r.status !== "open" && r.status !== "reviewing";
  const mineAlready = Boolean(r.assignedTo && r.assignedTo === admin?.id);

  return (
    <div className="mt-4 border-l-2 border-subtle pl-4">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <Facts
            rows={[
              { label: "Report", value: <span className="font-mono">{shortId(r.id)}</span> },
              {
                label: "Target",
                value: `${words(r.targetType)} ${shortId(r.targetId)}`,
              },
              { label: "Target user", value: shortId(r.targetUserId) },
              {
                label: "Reporter",
                value: `${r.reporterHandle} (${shortId(r.reporterId)})`,
              },
              { label: "Season", value: shortId(r.seasonId) },
              { label: "Action taken", value: r.action ? words(r.action) : "—" },
              {
                label: "Closed",
                value: r.resolvedAt
                  ? `${formatDateTime(r.resolvedAt)} by ${shortId(r.resolvedBy)}`
                  : "—",
              },
              { label: "Filed", value: formatDateTime(r.createdAt) },
            ]}
          />

          {r.details && (
            <div>
              <p className={labelCls}>What they said</p>
              <p className="mt-1 text-xs leading-6">{r.details}</p>
            </div>
          )}
          {r.context && (
            <div>
              <p className={labelCls}>Context</p>
              <p className="mt-1 text-xs leading-6 text-muted">{r.context}</p>
            </div>
          )}
          {r.note && (
            <div>
              <p className={labelCls}>Reviewer&apos;s note</p>
              <p className="mt-1 text-xs leading-6 text-muted">{r.note}</p>
            </div>
          )}

          <div>
            <p className={labelCls}>The thing itself</p>
            <p className="mt-1 text-xs text-muted">
              {d.target.exists ? "still there" : "gone"} ·{" "}
              {d.target.hidden ? "hidden from the feed" : "visible"} ·{" "}
              {d.target.status ?? "no status"} · {d.target.openReporters}{" "}
              open {d.target.openReporters === 1 ? "reporter" : "reporters"}
            </p>
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-muted">
              Snapshot as it was when reported
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-[2px] bg-surface p-3 text-[10px] leading-5">
              {JSON.stringify(r.snapshot, null, 2)}
            </pre>
          </details>

          {d.siblings.length > 0 && (
            <div>
              <p className={labelCls}>
                {d.siblings.length} other open{" "}
                {d.siblings.length === 1 ? "report" : "reports"} on this
              </p>
              <ul className="mt-1 space-y-1 text-xs text-muted">
                {d.siblings.map((s) => (
                  <li key={s.id}>
                    {s.reasonLabel} · {s.reporterHandle} · {s.status}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(d.reporter || d.targetUser) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {d.reporter && (
                <Party title="This reporter" stats={d.reporter} />
              )}
              {d.targetUser && (
                <Party title="This person" stats={d.targetUser} />
              )}
            </div>
          )}
          <p className="text-[11px] leading-5 text-muted">
            Both records are context, not a verdict. A reporter whose reports
            are mostly dismissed may still be right this time, and someone with
            reports upheld against them may still be reported unfairly.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            {!r.assignedTo && (
              <button
                type="button"
                disabled={busy || closed}
                onClick={() =>
                  void act(
                    () => gameApi.claimReport(id),
                    "Claimed. It is yours to close.",
                  )
                }
                className={btnOutline}
              >
                Claim
              </button>
            )}
            {/* Claiming one somebody already holds is refused, so taking it
                over is a separate, deliberate press rather than a retry. */}
            {r.assignedTo && !closed && (
              <ConfirmButton
                label={mineAlready ? "Re-claim" : "Take it over"}
                disabled={busy}
                onConfirm={() =>
                  act(
                    () => gameApi.claimReport(id, true),
                    "Taken over. It is yours to close.",
                  )
                }
              />
            )}
            <div className="flex items-center gap-2">
              <label htmlFor={`prio-${id}`} className={labelCls}>
                Priority
              </label>
              <select
                id={`prio-${id}`}
                value={String(r.priority)}
                disabled={busy}
                onChange={(e) =>
                  void act(
                    () =>
                      gameApi.setReportPriority(
                        id,
                        Number(e.target.value) as ReportPriority,
                      ),
                    `Priority set to ${e.target.value}.`,
                  )
                }
                className={selectCls}
              >
                {[0, 1, 2, 3].map((p) => (
                  <option key={p} value={p}>
                    P{p}
                  </option>
                ))}
              </select>
            </div>
            {closed && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(
                    () => gameApi.reopenReport(id),
                    "Reopened.",
                  )
                }
                className={btnOutline}
              >
                Reopen
              </button>
            )}
          </div>

          {!closed && (
            <ResolveForm
              detail={d}
              busy={busy}
              onResolve={(input) =>
                act(
                  () => gameApi.resolveReport(id, input),
                  (result) => {
                    const res = result as Awaited<
                      ReturnType<typeof gameApi.resolveReport>
                    >;
                    const siblings =
                      res.siblingsClosed > 0
                        ? ` ${res.siblingsClosed} sibling report(s) closed with it.`
                        : "";
                    const acted = res.actionResult
                      ? ` Action result: ${JSON.stringify(res.actionResult)}`
                      : "";
                    return `Closed as ${res.report.status}.${siblings}${acted}`;
                  },
                )
              }
            />
          )}
          <Note>{note}</Note>
        </div>
      </div>
    </div>
  );
}

function Party({
  title,
  stats,
}: {
  title: string;
  stats: NonNullable<ReportDetail["reporter"]>;
}) {
  return (
    <div>
      <p className={labelCls}>{title}</p>
      <p className="mt-1 text-xs leading-6 text-muted">
        filed {stats.filed} ({stats.filedUpheld} upheld,{" "}
        {stats.filedDismissed} dismissed)
        <br />
        reported {stats.received} times ({stats.receivedUpheld} upheld,{" "}
        {stats.receivedOpen} still open)
      </p>
    </div>
  );
}

function ResolveForm({
  detail,
  busy,
  onResolve,
}: {
  detail: ReportDetail;
  busy: boolean;
  onResolve: (input: {
    status: ClosingStatus;
    action?: ReportAction;
    note?: string;
    reporterMessage?: string;
    includeSiblings?: boolean;
    notifyReporter?: boolean;
  }) => Promise<void>;
}) {
  const [status, setStatus] = useState<ClosingStatus>("resolved");
  const [action, setAction] = useState<ReportAction>("none");
  const [note, setNote] = useState("");
  const [reporterMessage, setReporterMessage] = useState("");
  const [includeSiblings, setIncludeSiblings] = useState(
    detail.siblings.length > 0,
  );
  const [notifyReporter, setNotifyReporter] = useState(true);

  return (
    <div className="border-t border-subtle pt-4">
      <p className="text-sm font-bold uppercase tracking-[0.15em]">Close it</p>
      <p className="mt-1 text-[11px] leading-5 text-muted">
        An action here does the real thing through the same code the other
        screens use: removing content hides it, flagging a cheater zeroes them,
        retiring a task takes it out of the pool.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className={labelCls}>Outcome</legend>
          <div className="flex gap-4 pt-1">
            {(["resolved", "dismissed"] as ClosingStatus[]).map((value) => (
              <label
                key={value}
                className="flex items-center gap-2 text-xs uppercase tracking-wide"
              >
                <input
                  type="radio"
                  name={`outcome-${detail.report.id}`}
                  value={value}
                  checked={status === value}
                  onChange={() => setStatus(value)}
                />
                {value}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor={`action-${detail.report.id}`} className={labelCls}>
            Action
          </label>
          <select
            id={`action-${detail.report.id}`}
            value={action}
            onChange={(e) => setAction(e.target.value as ReportAction)}
            className={selectCls}
          >
            {detail.actions.map((a) => (
              <option key={a} value={a}>
                {words(a)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <Field id={`note-${detail.report.id}`} label="Note (internal)">
          <textarea
            id={`note-${detail.report.id}`}
            value={note}
            maxLength={1000}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            className={textareaCls}
            placeholder="What you found, for whoever reads this next."
          />
        </Field>
        <Field
          id={`reply-${detail.report.id}`}
          label="Message to the reporter"
        >
          <textarea
            id={`reply-${detail.report.id}`}
            value={reporterMessage}
            maxLength={500}
            rows={2}
            onChange={(e) => setReporterMessage(e.target.value)}
            className={textareaCls}
            placeholder="They see this one."
          />
        </Field>
        <div className="flex flex-wrap gap-6 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeSiblings}
              onChange={(e) => setIncludeSiblings(e.target.checked)}
              disabled={detail.siblings.length === 0}
            />
            Also close the {detail.siblings.length} other open report
            {detail.siblings.length === 1 ? "" : "s"} on this
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notifyReporter}
              onChange={(e) => setNotifyReporter(e.target.checked)}
            />
            Tell the reporter
          </label>
        </div>
      </div>

      <div className="mt-4">
        <ConfirmButton
          label={`Close as ${status}`}
          confirmLabel="Confirm — this closes it"
          disabled={busy}
          className={btnSolidSm}
          onConfirm={() =>
            onResolve({
              status,
              action: action === "none" ? undefined : action,
              note: note.trim() || undefined,
              reporterMessage: reporterMessage.trim() || undefined,
              includeSiblings,
              notifyReporter,
            })
          }
        />
      </div>
    </div>
  );
}
