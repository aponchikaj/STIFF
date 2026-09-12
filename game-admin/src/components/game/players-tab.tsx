"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { gameApi } from "@/lib/api";
import type {
  EnrolmentRole,
  EnrolmentStatus,
  GameEnrolment,
  ScoreLedgerRow,
} from "@/lib/api";
import { ENROLMENT_STATUSES } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  btnDanger,
  btnGhost,
  btnPrimarySm,
  btnSecondarySm,
  cardCls,
  checkboxCls,
  chipCls,
  ErrorNote,
  eyebrow,
  Field,
  inputCls,
  labelCls,
  Loading,
  Panel,
  selectCls,
  Stat,
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
  Hearts,
  Note,
  Pill,
  formatDateTime,
  shortId,
  timeAgo,
  useAction,
  words,
} from "./game-ui";

type RoleFilter = "all" | EnrolmentRole;
type StatusFilter = "all" | EnrolmentStatus;

const ROLE_CHIPS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "player", label: "Players" },
  { value: "watcher", label: "Watchers" },
];

const STATUS_TONE: Record<EnrolmentStatus, Tone> = {
  active: "positive",
  demoted: "caution",
  cheater: "danger",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "+25" / "−25" with a real minus sign, so the ledger column lines up. */
function signed(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`;
}

function isRole(value: string | null): value is EnrolmentRole {
  return value === "player" || value === "watcher";
}

/**
 * Everyone in the live season, and the three things an operator does to one
 * of them: correct a score on the record, flag a cheater, or bring them back.
 */
export function PlayersTab() {
  const params = useSearchParams();
  // The overview links here with ?role=player / ?role=watcher.
  const initialRole = params.get("role");
  const [role, setRole] = useState<RoleFilter>(
    isRole(initialRole) ? initialRole : "all",
  );
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(
    () =>
      gameApi.listEnrolments({
        role: role === "all" ? undefined : role,
        status: status === "all" ? undefined : status,
        limit: 500,
      }),
    [role, status],
  );

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const people = useMemo(() => data?.enrolments ?? [], [data]);
  const shown = useMemo(
    () =>
      query
        ? people.filter((p) => p.handle.toLowerCase().includes(query))
        : people,
    [people, query],
  );
  const counts = tally(people);

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------- the count */}
      <div
        className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}
      >
        <div className="p-5">
          <Stat label="Players" value={counts.players} hint="on the board" />
        </div>
        <div className="p-5">
          <Stat label="Watchers" value={counts.watchers} hint="off it" />
        </div>
        <div className="p-5">
          <Stat
            label="Demoted"
            value={counts.demoted}
            hint="hearts, minimum or balance"
            tone={counts.demoted > 0 ? "caution" : undefined}
          />
        </div>
        <div className="p-5">
          <Stat
            label="Cheaters"
            value={counts.cheaters}
            hint="flagged by a person or the model"
            tone={counts.cheaters > 0 ? "danger" : undefined}
          />
        </div>
      </div>

      {/* -------------------------------------------------------- the list */}
      <Panel
        title="Everyone in the season"
        bleed
        aside={
          data && (
            <span className="tnum text-[11px] text-faint">
              {shown.length === people.length
                ? `${people.length} enrolled`
                : `${shown.length} of ${people.length} enrolled`}
            </span>
          )
        }
      >
        <div className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <span className={labelCls} id="players-role-label">
              Role
            </span>
            <div
              role="group"
              aria-labelledby="players-role-label"
              className="flex flex-wrap gap-2"
            >
              {ROLE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={role === chip.value}
                  onClick={() => setRole(chip.value)}
                  className={chipCls(role === chip.value)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-36">
            <Field id="players-status" label="Status">
              <select
                id="players-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                className={selectCls}
              >
                <option value="all">all</option>
                {ENROLMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="w-56">
            <Field id="players-search" label="Handle">
              <input
                id="players-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search handles"
                aria-label="Search handles"
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {loading && (
          <div className="px-5">
            <Loading label="Loading enrolments" />
          </div>
        )}
        {error && (
          <div className="px-5">
            <ErrorNote message={error} />
          </div>
        )}

        {data && people.length === 0 && !loading && (
          <Empty>
            Nobody here. The list covers the live season only, so it is empty
            between seasons — and empty for a filter nobody matches.
          </Empty>
        )}
        {data && people.length > 0 && shown.length === 0 && (
          <Empty>No handle contains “{search.trim()}”.</Empty>
        )}

        {shown.length > 0 && (
          <TableScroll>
            <table className={tableCls}>
              <thead>
                <tr className={theadCls}>
                  <th className={thCls}>Handle</th>
                  <th className={thCls}>Standing</th>
                  <th className={`${thCls} text-right`}>Nerve</th>
                  <th className={`${thCls} text-right`}>Coins</th>
                  <th className={thCls}>Hearts</th>
                  <th className={thCls}>Joined</th>
                  <th className={`${thCls} text-right`}>
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const open = openId === p.id;
                  return (
                    <Fragment key={p.id}>
                      <tr className={trCls}>
                        <td className={tdCls}>
                          <span className="block text-[13px] font-bold">
                            {p.handle}
                          </span>
                          {p.status !== "active" && (
                            <span className="mt-0.5 block text-[11px] text-faint">
                              {words(p.demotionReason)} · {timeAgo(p.demotedAt)}
                            </span>
                          )}
                        </td>
                        <td className={tdCls}>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Pill tone={p.role === "player" ? "solid" : "neutral"}>
                              {p.role}
                            </Pill>
                            <Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill>
                          </span>
                        </td>
                        <td className={`${tdCls} tnum text-right font-bold`}>
                          {p.nerve}
                        </td>
                        <td className={`${tdCls} tnum text-right text-muted`}>
                          {p.coins}
                        </td>
                        <td className={tdCls}>
                          <Hearts
                            remaining={p.heartsRemaining}
                            total={p.heartsTotal}
                          />
                        </td>
                        <td
                          className={`${tdCls} whitespace-nowrap text-[11px] text-faint`}
                        >
                          {formatDateTime(p.createdAt)}
                        </td>
                        <td className={`${tdCls} text-right`}>
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={`enrolment-${p.id}`}
                            onClick={() => setOpenId(open ? null : p.id)}
                            className={btnGhost}
                          >
                            {open ? "Close" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-t border-line">
                          <td colSpan={7} className="bg-raised p-0">
                            <div id={`enrolment-${p.id}`} className="p-5">
                              <EnrolmentDetails
                                enrolment={p}
                                reloadList={reload}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- details --

function EnrolmentDetails({
  enrolment: p,
  reloadList,
}: {
  enrolment: GameEnrolment;
  reloadList: () => void;
}) {
  const ledger = useAsync(() => gameApi.getScoreLedger(p.id, 100), [p.id]);
  const { note, busy, act } = useAction(() => {
    ledger.reload();
    reloadList();
  });

  const snap = p.demotionSnapshot;
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "id", value: <code className="text-[11px]">{p.id}</code> },
    { label: "user", value: <code className="text-[11px]">{p.userId}</code> },
    {
      label: "season",
      value: <code className="text-[11px]">{p.seasonId}</code>,
    },
    { label: "last scored", value: formatDateTime(p.lastScoredAt) },
    { label: "last vote win", value: formatDateTime(p.lastVoteWinAt) },
  ];
  if (snap) {
    facts.push({
      label: "at demotion",
      value: `${snap.nerve} Nerve · ${snap.heartsRemaining} hearts${snap.coins != null ? ` · ${snap.coins} coins` : ""}${snap.attemptId ? ` · attempt ${shortId(snap.attemptId)}` : ""} · by ${snap.by}`,
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <Panel title="Record">
          <Facts rows={facts} />
        </Panel>

        <Panel
          title="Score ledger"
          bleed
          aside={
            <span className="text-[11px] text-faint">
              the score is always the sum of these rows
            </span>
          }
        >
          {ledger.loading && (
            <div className="px-5">
              <Loading label="Loading the ledger" />
            </div>
          )}
          {ledger.error && (
            <div className="px-5">
              <ErrorNote message={ledger.error} />
            </div>
          )}
          {ledger.data && ledger.data.ledger.length === 0 && (
            <Empty>No Nerve has moved yet.</Empty>
          )}
          {ledger.data && ledger.data.ledger.length > 0 && (
            <LedgerTable rows={ledger.data.ledger} />
          )}
        </Panel>
      </div>

      <div className="min-w-0">
        <Panel title="Act on this enrolment">
          <div className="flex flex-col gap-5">
            <AdjustScore
              enrolmentId={p.id}
              busy={busy}
              onSubmit={(delta, reason) =>
                act(
                  () => gameApi.adjustScore(p.id, { delta, reason }),
                  (r) => {
                    const res = r as Awaited<
                      ReturnType<typeof gameApi.adjustScore>
                    >;
                    // The backend floors at zero, so what moved can be less
                    // than what was asked; say what actually happened.
                    const floored = res.nerveDelta !== delta;
                    return `Moved ${signed(res.nerveDelta)} Nerve; now ${res.nerve}.${floored ? ` (Asked ${signed(delta)}; Nerve floors at zero.)` : ""}`;
                  },
                )
              }
            />

            {p.status !== "cheater" && (
              <FlagCheater
                busy={busy}
                onConfirm={(reason, attemptId) =>
                  act(
                    () => gameApi.flagCheater(p.id, { reason, attemptId }),
                    `${p.handle} flagged: Nerve, hearts and coins zeroed, now a watcher.`,
                  )
                }
              />
            )}

            {p.status !== "active" && (
              <Reinstate
                busy={busy}
                onConfirm={(restore) =>
                  act(
                    () => gameApi.reinstate(p.id, { restore }),
                    `${p.handle} reinstated as a player${restore ? ", with what was zeroed put back" : ", from zero"}.`,
                  )
                }
              />
            )}

            <div className="border-t border-line pt-3.5">
              <Note>{note}</Note>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function LedgerTable({ rows }: { rows: ScoreLedgerRow[] }) {
  return (
    <TableScroll>
      <table className={tableCls}>
        <thead>
          <tr className={theadCls}>
            <th className={thCls}>When</th>
            <th className={`${thCls} text-right`}>Delta</th>
            <th className={`${thCls} text-right`}>After</th>
            <th className={thCls}>Reason</th>
            <th className={thCls}>Ref</th>
            <th className={thCls}>By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={trCls}>
              <td className={`${tdCls} whitespace-nowrap text-[11px] text-faint`}>
                {formatDateTime(row.createdAt)}
              </td>
              <td
                className={`${tdCls} tnum text-right font-bold ${
                  row.delta < 0 ? "text-danger" : "text-positive"
                }`}
              >
                {signed(row.delta)}
              </td>
              <td className={`${tdCls} tnum text-right`}>{row.scoreAfter}</td>
              <td className={tdCls}>{words(row.reason)}</td>
              <td className={`${tdCls} whitespace-nowrap text-muted`}>
                {row.refType ? `${row.refType} ${shortId(row.refId)}` : "—"}
              </td>
              <td className={`${tdCls} whitespace-nowrap text-muted`}>
                {/* `by` is an admin id or a word like `ai`; only ids get cut. */}
                {row.by ? (UUID_RE.test(row.by) ? shortId(row.by) : row.by) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

// ---------------------------------------------------------------- actions --

function AdjustScore({
  enrolmentId,
  busy,
  onSubmit,
}: {
  enrolmentId: string;
  busy: boolean;
  onSubmit: (delta: number, reason: string) => Promise<void>;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const deltaId = `adjust-delta-${enrolmentId}`;
  const reasonId = `adjust-reason-${enrolmentId}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(delta);
    const trimmed = reason.trim();
    if (!Number.isInteger(n) || n === 0 || Math.abs(n) > 10000) {
      setProblem("Delta must be a whole number other than zero, within ±10,000.");
      return;
    }
    if (trimmed.length < 3 || trimmed.length > 200) {
      setProblem("Reason must be 3 to 200 characters.");
      return;
    }
    setProblem(null);
    void onSubmit(n, trimmed).then(() => {
      setDelta("");
      setReason("");
    });
  }

  return (
    <section>
      <p className={eyebrow}>Adjust score</p>
      <p className="mt-1.5 text-[12px] leading-5 text-faint">
        A correction on the record: one ledger row, reason attached. Nerve
        floors at zero.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)]">
          <Field id={deltaId} label="Delta">
            <input
              id={deltaId}
              type="number"
              inputMode="numeric"
              step={1}
              min={-10000}
              max={10000}
              required
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="−25 or 40"
              className={`${inputCls} tnum`}
            />
          </Field>
          <Field id={reasonId} label="Reason">
            <input
              id={reasonId}
              type="text"
              required
              minLength={3}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this moves"
              className={inputCls}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={btnPrimarySm}>
            Apply
          </button>
          {problem && (
            <span role="alert" className="text-[11px] leading-5 text-danger">
              {problem}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

function FlagCheater({
  busy,
  onConfirm,
}: {
  busy: boolean;
  onConfirm: (reason?: string, attemptId?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [attemptId, setAttemptId] = useState("");
  const attempt = attemptId.trim();
  const attemptOk = attempt === "" || UUID_RE.test(attempt);

  return (
    <section className="border-t border-line pt-5">
      <p className={eyebrow}>Flag as cheater</p>
      <p className="mt-1.5 text-[12px] leading-5 text-faint">
        Zeroes Nerve, hearts and coins, moves them to watcher, and labels every
        comment they write; the attempt, if given, is rejected too.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <Field id="flag-reason" label="Reason (optional)">
          <textarea
            id="flag-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What was seen"
            className={textareaCls}
          />
        </Field>
        <Field id="flag-attempt" label="Attempt id (optional)">
          <input
            id="flag-attempt"
            type="text"
            value={attemptId}
            onChange={(e) => setAttemptId(e.target.value)}
            placeholder="UUID of the offending hand-in"
            aria-invalid={!attemptOk}
            className={`${inputCls} font-mono text-[12px]`}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <ConfirmButton
            label="Flag as cheater"
            confirmLabel="Zero them and demote?"
            disabled={busy || !attemptOk}
            className={btnDanger}
            onConfirm={() =>
              onConfirm(
                reason.trim() || undefined,
                attempt || undefined,
              ).then(() => {
                setReason("");
                setAttemptId("");
              })
            }
          />
          {!attemptOk && (
            <span role="alert" className="text-[11px] leading-5 text-danger">
              That is not a UUID.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function Reinstate({
  busy,
  onConfirm,
}: {
  busy: boolean;
  onConfirm: (restore: boolean) => Promise<void>;
}) {
  const [restore, setRestore] = useState(true);
  return (
    <section className="border-t border-line pt-5">
      <p className={eyebrow}>Reinstate</p>
      <p className="mt-1.5 text-[12px] leading-5 text-faint">
        The one way back to player. Their cheater label, if any, comes off.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <label className="flex items-start gap-2.5 text-[12px] leading-5">
          <input
            type="checkbox"
            checked={restore}
            onChange={(e) => setRestore(e.target.checked)}
            className={`${checkboxCls} mt-0.5`}
          />
          <span>Restore what was zeroed (Nerve, hearts, coins at demotion)</span>
        </label>
        <div>
          <ConfirmButton
            label="Reinstate as player"
            confirmLabel={
              restore ? "Restore and reinstate?" : "Reinstate from zero?"
            }
            disabled={busy}
            className={btnSecondarySm}
            tone="neutral"
            onConfirm={() => onConfirm(restore)}
          />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- helpers --

function tally(people: GameEnrolment[]) {
  let players = 0;
  let watchers = 0;
  let demoted = 0;
  let cheaters = 0;
  for (const p of people) {
    if (p.role === "player") players += 1;
    else watchers += 1;
    if (p.status === "demoted") demoted += 1;
    if (p.status === "cheater") cheaters += 1;
  }
  return { players, watchers, demoted, cheaters };
}
