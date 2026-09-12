"use client";

import { useEffect, useMemo, useState } from "react";
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
  btnGhostSm,
  btnOutline,
  btnSolidSm,
  chipCls,
  ErrorNote,
  Field,
  inputCls,
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
  formatDateTime,
  hearts,
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

const STATUS_TONE: Record<EnrolmentStatus, "neutral" | "outline" | "warn"> = {
  active: "neutral",
  demoted: "outline",
  cheater: "warn",
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
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Players" value={counts.players} hint="on the board" />
        <Stat label="Watchers" value={counts.watchers} hint="off it" />
        <Stat label="Demoted" value={counts.demoted} hint="hearts, minimum or balance" />
        <Stat label="Cheaters" value={counts.cheaters} hint="flagged by a person or the model" />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
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
        <Field id="players-search" label="Handle">
          <input
            id="players-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search handles"
            aria-label="Search handles"
            className={`${inputCls} h-10 w-64`}
          />
        </Field>
      </div>

      {loading && <Loading label="Loading enrolments" />}
      {error && <ErrorNote message={error} />}

      {data && people.length === 0 && !loading && (
        <Empty>
          Nobody here. The list covers the live season only, so it is empty
          between seasons — and empty for a filter nobody matches.
        </Empty>
      )}
      {data && people.length > 0 && shown.length === 0 && (
        <Empty>No handle contains “{search.trim()}”.</Empty>
      )}

      <ul className="border-t border-subtle">
        {shown.map((p) => {
          const open = openId === p.id;
          return (
            <li key={p.id} className="border-b border-subtle py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold uppercase tracking-wide">
                    {p.handle}
                  </span>
                  <Pill tone={p.role === "player" ? "solid" : "neutral"}>
                    {p.role}
                  </Pill>
                  <Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill>
                  {p.status !== "active" && (
                    <span className="text-xs text-muted">
                      {words(p.demotionReason)} · {timeAgo(p.demotedAt)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-baseline gap-4 text-xs text-muted">
                  <span className="tabular-nums text-foreground">
                    {p.nerve} Nerve
                  </span>
                  <span className="tabular-nums">{p.coins} coins</span>
                  <span
                    className="text-[10px] tracking-widest"
                    aria-label={`${p.heartsRemaining} of ${p.heartsTotal} hearts`}
                  >
                    {hearts(p.heartsRemaining, p.heartsTotal)}
                  </span>
                  <span>joined {formatDateTime(p.createdAt)}</span>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`enrolment-${p.id}`}
                    onClick={() => setOpenId(open ? null : p.id)}
                    className={btnGhostSm}
                  >
                    {open ? "Close" : "Details"}
                  </button>
                </div>
              </div>
              {open && (
                <div id={`enrolment-${p.id}`} className="mt-6">
                  <EnrolmentDetails enrolment={p} reloadList={reload} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
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
    { label: "season", value: <code className="text-[11px]">{p.seasonId}</code> },
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
    <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-10">
        <section>
          <SectionTitle>Record</SectionTitle>
          <Facts rows={facts} />
        </section>

        <section>
          <SectionTitle
            aside={
              <span className="text-xs text-muted">
                the score is always the sum of these rows
              </span>
            }
          >
            Score ledger
          </SectionTitle>
          {ledger.loading && <Loading label="Loading the ledger" />}
          {ledger.error && <ErrorNote message={ledger.error} />}
          {ledger.data && ledger.data.ledger.length === 0 && (
            <Empty>No Nerve has moved yet.</Empty>
          )}
          {ledger.data && ledger.data.ledger.length > 0 && (
            <LedgerTable rows={ledger.data.ledger} />
          )}
        </section>
      </div>

      <div className="space-y-10">
        <AdjustScore
          enrolmentId={p.id}
          busy={busy}
          onSubmit={(delta, reason) =>
            act(
              () => gameApi.adjustScore(p.id, { delta, reason }),
              (r) => {
                const res = r as Awaited<ReturnType<typeof gameApi.adjustScore>>;
                // The backend floors at zero, so what moved can be less than
                // what was asked; say what actually happened.
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

        <Note>{note}</Note>
      </div>
    </div>
  );
}

function LedgerTable({ rows }: { rows: ScoreLedgerRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-t border-subtle text-xs">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-2 pr-4 font-medium">when</th>
            <th className="py-2 pr-4 text-right font-medium">delta</th>
            <th className="py-2 pr-4 text-right font-medium">after</th>
            <th className="py-2 pr-4 font-medium">reason</th>
            <th className="py-2 pr-4 font-medium">ref</th>
            <th className="py-2 font-medium">by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-subtle">
              <td className="whitespace-nowrap py-2 pr-4 text-muted">
                {formatDateTime(row.createdAt)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {signed(row.delta)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {row.scoreAfter}
              </td>
              <td className="py-2 pr-4">{words(row.reason)}</td>
              <td className="whitespace-nowrap py-2 pr-4 text-muted">
                {row.refType ? `${row.refType} ${shortId(row.refId)}` : "—"}
              </td>
              <td className="whitespace-nowrap py-2 text-muted">
                {/* `by` is an admin id or a word like `ai`; only ids get cut. */}
                {row.by ? (UUID_RE.test(row.by) ? shortId(row.by) : row.by) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
      <SectionTitle>Adjust score</SectionTitle>
      <p className="mb-4 text-xs leading-6 text-muted">
        A correction on the record: one ledger row, reason attached. Nerve
        floors at zero.
      </p>
      <form onSubmit={submit} className="space-y-4">
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
            className={`${inputCls} h-10 tabular-nums`}
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
            className={`${inputCls} h-10`}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy} className={btnSolidSm}>
            Apply
          </button>
          {problem && (
            <span role="alert" className="text-xs text-muted">
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
    <section>
      <SectionTitle>Flag as cheater</SectionTitle>
      <p className="mb-4 text-xs leading-6 text-muted">
        Zeroes Nerve, hearts and coins, moves them to watcher, and labels every
        comment they write; the attempt, if given, is rejected too.
      </p>
      <div className="space-y-4">
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
            className={`${inputCls} h-10 font-mono text-xs`}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <ConfirmButton
            label="Flag as cheater"
            confirmLabel="Zero them and demote?"
            disabled={busy || !attemptOk}
            className={btnOutline}
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
            <span role="alert" className="text-xs text-muted">
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
    <section>
      <SectionTitle>Reinstate</SectionTitle>
      <p className="mb-4 text-xs leading-6 text-muted">
        The one way back to player. Their cheater label, if any, comes off.
      </p>
      <div className="space-y-4">
        <label className="flex items-center gap-3 text-xs">
          <input
            type="checkbox"
            checked={restore}
            onChange={(e) => setRestore(e.target.checked)}
            className="size-4 accent-foreground"
          />
          <span>Restore what was zeroed (Nerve, hearts, coins at demotion)</span>
        </label>
        <ConfirmButton
          label="Reinstate as player"
          confirmLabel={restore ? "Restore and reinstate?" : "Reinstate from zero?"}
          disabled={busy}
          className={btnOutline}
          onConfirm={() => onConfirm(restore)}
        />
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
