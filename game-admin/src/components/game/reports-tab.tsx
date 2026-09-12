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
  btnGhost,
  btnSecondarySm,
  Card,
  cardCls,
  checkboxCls,
  chipCls,
  ErrorNote,
  eyebrow,
  Field,
  labelCls,
  Loading,
  Panel,
  selectCls,
  tableCls,
  TableScroll,
  tdCls,
  textareaCls,
  thCls,
  theadCls,
  trCls,
  type Tone,
} from "../ui";
import {
  ConfirmButton,
  Empty,
  Facts,
  Note,
  Pill,
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

/** The number of table columns, so the detail row spans all of them. */
const COLUMNS = 7;

/** P3 is a person possibly at risk; it should never sit behind P0 tidying. */
function priorityTone(p: ReportPriority): Tone {
  return p === 3 ? "danger" : p === 2 ? "caution" : p === 1 ? "outline" : "neutral";
}

function statusTone(status: ReportStatus): Tone {
  return status === "open"
    ? "info"
    : status === "reviewing"
      ? "solid"
      : status === "resolved"
        ? "positive"
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
    <div className="flex flex-col gap-5">
      {/* --------------------------------------------------------- the count */}
      <div
        className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}
      >
        <div className="p-5">
          <Stat
            label="Open"
            value={stats.data ? openCount : "…"}
            hint={
              stats.data
                ? `${stats.data.byStatus.reviewing} being looked at`
                : undefined
            }
          />
        </div>
        <div className="p-5">
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
            tone={
              stats.data && stats.data.openByPriority["3"] > 0
                ? "danger"
                : undefined
            }
          />
        </div>
        <div className="p-5">
          <Stat
            label="Oldest open"
            value={
              stats.data?.oldestOpenSeconds != null
                ? durationWords(stats.data.oldestOpenSeconds)
                : "—"
            }
            hint="waiting for a person"
          />
        </div>
        <div className="p-5">
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
      </div>

      {/* ------------------------------------------------------ most reported */}
      {stats.data && stats.data.mostReported.length > 0 && (
        <Panel title="Most reported" bleed>
          <ul>
            {stats.data.mostReported.map((row) => (
              <li
                key={`${row.targetType}-${row.targetId}`}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <Pill>{words(row.targetType)}</Pill>
                  <span className="truncate text-[13px] font-bold">
                    {row.about}
                  </span>
                </span>
                <span className="tnum text-[11px] text-faint">
                  {row.reporters} different reporters
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* -------------------------------------------------------- the reports */}
      <Panel
        title="Reports"
        aside={
          <span className="tnum text-[11px] text-faint">
            {total === 0 ? "nothing" : `${first}–${last} of ${total}`}
          </span>
        }
        bleed
      >
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line px-5 py-3">
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

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
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
            <div className="flex flex-col gap-1.5">
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
        </div>

        {list.loading && (
          <div className="px-5">
            <Loading label="Loading reports" />
          </div>
        )}
        {list.error && (
          <div className="px-5 py-2">
            <ErrorNote message={list.error} />
          </div>
        )}
        {list.data && items.length === 0 && !list.loading && (
          <Empty>Nothing in the queue.</Empty>
        )}

        {items.length > 0 && (
          <TableScroll>
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th scope="col" className={`${thCls} w-16`}>
                    Priority
                  </th>
                  <th scope="col" className={thCls}>
                    About
                  </th>
                  <th scope="col" className={thCls}>
                    Reason
                  </th>
                  <th scope="col" className={thCls}>
                    Status
                  </th>
                  <th scope="col" className={thCls}>
                    Reporter
                  </th>
                  <th scope="col" className={thCls}>
                    Filed
                  </th>
                  <th scope="col" className={`${thCls} text-right`}>
                    <span className="sr-only">Detail</span>
                  </th>
                </tr>
              </thead>
              <tbody>
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
              </tbody>
            </table>
          </TableScroll>
        )}

        {total > PAGE_SIZE && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => {
                setOffset(Math.max(offset - PAGE_SIZE, 0));
                setOpenId(null);
              }}
              className={btnSecondarySm}
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

// ------------------------------------------------------------------ row --

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
    <>
      <tr className={trCls}>
        <td className={tdCls}>
          <Pill tone={priorityTone(report.priority)}>P{report.priority}</Pill>
        </td>
        <td className={tdCls}>
          <div className="flex flex-wrap items-center gap-2">
            <Pill>{words(report.targetType)}</Pill>
            <span className="font-bold">{report.about}</span>
          </div>
          {report.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {report.tags.map((tag) => (
                <Pill key={tag}>{words(tag)}</Pill>
              ))}
            </div>
          )}
        </td>
        <td className={`${tdCls} text-muted`}>{report.reasonLabel}</td>
        <td className={tdCls}>
          <Pill tone={statusTone(report.status)}>{report.status}</Pill>
          {report.assignedTo && (
            <p className="mt-1.5 text-[11px] text-faint">
              {mine ? "assigned to you" : `held by ${shortId(report.assignedTo)}`}
            </p>
          )}
        </td>
        <td className={`${tdCls} text-muted`}>{report.reporterHandle}</td>
        <td className={`${tdCls} tnum whitespace-nowrap text-faint`}>
          {timeAgo(report.createdAt)}
        </td>
        <td className={`${tdCls} text-right`}>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className={btnGhost}
          >
            {open ? "Close" : "Open"}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={COLUMNS} className="border-t border-line bg-raised p-0">
            <ReportPane id={report.id} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  );
}

// ----------------------------------------------------------------- pane --

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

  if (detail.loading)
    return (
      <div className="px-5">
        <Loading label="Loading the report" />
      </div>
    );
  if (detail.error)
    return (
      <div className="px-5 py-2">
        <ErrorNote message={detail.error} />
      </div>
    );
  if (!detail.data) return null;

  const d: ReportDetail = detail.data;
  const r = d.report;
  const closed = r.status !== "open" && r.status !== "reviewing";
  const mineAlready = Boolean(r.assignedTo && r.assignedTo === admin?.id);

  return (
    <div className="grid gap-4 p-5 xl:grid-cols-2">
      {/* ----------------------------------------------------- what happened */}
      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <p className={eyebrow}>The filing</p>
          <div className="mt-3">
            <Facts
              rows={[
                {
                  label: "Report",
                  value: <span className="font-mono">{shortId(r.id)}</span>,
                },
                {
                  label: "Target",
                  value: (
                    <span className="font-mono">
                      {words(r.targetType)} {shortId(r.targetId)}
                    </span>
                  ),
                },
                {
                  label: "Target user",
                  value: <span className="font-mono">{shortId(r.targetUserId)}</span>,
                },
                {
                  label: "Reporter",
                  value: `${r.reporterHandle} (${shortId(r.reporterId)})`,
                },
                {
                  label: "Season",
                  value: <span className="font-mono">{shortId(r.seasonId)}</span>,
                },
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
          </div>
        </Card>

        {(r.details || r.context || r.note) && (
          <Card className="flex flex-col gap-4 p-5">
            {r.details && (
              <div>
                <p className={eyebrow}>What they said</p>
                <p className="mt-1.5 text-[13px] leading-6 text-ink">
                  {r.details}
                </p>
              </div>
            )}
            {r.context && (
              <div>
                <p className={eyebrow}>Context</p>
                <p className="mt-1.5 text-[13px] leading-6 text-muted">
                  {r.context}
                </p>
              </div>
            )}
            {r.note && (
              <div>
                <p className={eyebrow}>Reviewer&apos;s note</p>
                <p className="mt-1.5 text-[13px] leading-6 text-muted">
                  {r.note}
                </p>
              </div>
            )}
          </Card>
        )}

        <Card className="flex flex-col gap-4 p-5">
          <div>
            <p className={eyebrow}>The thing itself</p>
            <p className="mt-1.5 text-[13px] leading-6 text-muted">
              {d.target.exists ? "still there" : "gone"} ·{" "}
              {d.target.hidden ? "hidden from the feed" : "visible"} ·{" "}
              {d.target.status ?? "no status"} · {d.target.openReporters}{" "}
              open {d.target.openReporters === 1 ? "reporter" : "reporters"}
            </p>
          </div>

          <details>
            <summary className="cursor-pointer text-[12px] text-muted hover:text-ink">
              Snapshot as it was when reported
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-[var(--radius-control)] bg-raised p-3 text-[11px] leading-5 text-muted">
              {JSON.stringify(r.snapshot, null, 2)}
            </pre>
          </details>

          {d.siblings.length > 0 && (
            <div>
              <p className={eyebrow}>
                {d.siblings.length} other open{" "}
                {d.siblings.length === 1 ? "report" : "reports"} on this
              </p>
              <ul className="mt-1.5 flex flex-col gap-1 text-[12px] text-muted">
                {d.siblings.map((s) => (
                  <li key={s.id}>
                    {s.reasonLabel} · {s.reporterHandle} · {s.status}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {(d.reporter || d.targetUser) && (
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {d.reporter && <Party title="This reporter" stats={d.reporter} />}
              {d.targetUser && <Party title="This person" stats={d.targetUser} />}
            </div>
            <p className="mt-4 border-t border-line pt-3 text-[11px] leading-5 text-faint">
              Both records are context, not a verdict. A reporter whose reports
              are mostly dismissed may still be right this time, and someone
              with reports upheld against them may still be reported unfairly.
            </p>
          </Card>
        )}
      </div>

      {/* --------------------------------------------------- what to do now */}
      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <p className={eyebrow}>Handling</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
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
                className={btnSecondarySm}
              >
                Claim
              </button>
            )}
            {/* Claiming one somebody already holds is refused, so taking it
                over is a separate, deliberate press rather than a retry. */}
            {r.assignedTo && !closed && (
              <ConfirmButton
                label={mineAlready ? "Re-claim" : "Take it over"}
                className={btnSecondarySm}
                disabled={busy}
                onConfirm={() =>
                  act(
                    () => gameApi.claimReport(id, true),
                    "Taken over. It is yours to close.",
                  )
                }
              />
            )}
            {closed && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(() => gameApi.reopenReport(id), "Reopened.")
                }
                className={btnSecondarySm}
              >
                Reopen
              </button>
            )}
            <div className="flex flex-col gap-1.5">
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
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <Note>{note}</Note>
          </div>
        </Card>

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
      <p className={eyebrow}>{title}</p>
      <p className="mt-1.5 text-[12px] leading-6 text-muted">
        filed <span className="tnum">{stats.filed}</span> (
        <span className="tnum">{stats.filedUpheld}</span> upheld,{" "}
        <span className="tnum">{stats.filedDismissed}</span> dismissed)
        <br />
        reported <span className="tnum">{stats.received}</span> times (
        <span className="tnum">{stats.receivedUpheld}</span> upheld,{" "}
        <span className="tnum">{stats.receivedOpen}</span> still open)
      </p>
    </div>
  );
}

// ----------------------------------------------------------------- close --

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
    <Card className="p-5">
      <p className={eyebrow}>Close it</p>
      <p className="mt-2 text-[12px] leading-5 text-muted">
        An action here does the real thing through the same code the other
        screens use: removing content hides it, flagging a cheater zeroes them,
        retiring a task takes it out of the pool.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <fieldset className="flex flex-col gap-1.5">
          <legend className={labelCls}>Outcome</legend>
          <div className="flex h-10 items-center gap-5">
            {(["resolved", "dismissed"] as ClosingStatus[]).map((value) => (
              <label
                key={value}
                className="flex items-center gap-2 text-[13px]"
              >
                <input
                  type="radio"
                  name={`outcome-${detail.report.id}`}
                  value={value}
                  checked={status === value}
                  onChange={() => setStatus(value)}
                  className={checkboxCls}
                />
                {value}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
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

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field id={`note-${detail.report.id}`} label="Note (internal)">
          <textarea
            id={`note-${detail.report.id}`}
            value={note}
            maxLength={1000}
            rows={3}
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
            rows={3}
            onChange={(e) => setReporterMessage(e.target.value)}
            className={textareaCls}
            placeholder="They see this one."
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-col gap-2.5 text-[13px]">
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={includeSiblings}
            onChange={(e) => setIncludeSiblings(e.target.checked)}
            disabled={detail.siblings.length === 0}
            className={checkboxCls}
          />
          Also close the {detail.siblings.length} other open report
          {detail.siblings.length === 1 ? "" : "s"} on this
        </label>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={notifyReporter}
            onChange={(e) => setNotifyReporter(e.target.checked)}
            className={checkboxCls}
          />
          Tell the reporter
        </label>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <ConfirmButton
          label={`Close as ${status}`}
          confirmLabel="Press again to close"
          disabled={busy}
          className={btnSecondarySm}
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
    </Card>
  );
}
