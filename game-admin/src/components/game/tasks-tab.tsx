"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { gameApi, TEMPLATE_STATUSES } from "@/lib/api";
import type {
  GameTaskTemplate,
  GenerateTasksResult,
  SeasonDay,
  TaskMode,
  TemplateStatus,
} from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  btnGhost,
  btnPrimary,
  cardCls,
  chipCls,
  ErrorNote,
  eyebrow,
  Field,
  inputCls,
  labelCls,
  Loading,
  Panel,
  selectCls,
  tableCls,
  TableScroll,
  tdCls,
  textareaCls,
  theadCls,
  thCls,
  trCls,
} from "../ui";
import {
  ConfirmButton,
  Empty,
  Facts,
  Note,
  Pill,
  Stat,
  formatDateTime,
  shortId,
  timeAgo,
  useAction,
  words,
} from "./game-ui";
import type { Tone } from "./game-ui";

type StatusFilter = TemplateStatus | "all";
type TierFilter = SeasonDay | "all";
type ModeChoice = TaskMode | "any";
type RowAction = "approve" | "review" | "retire";

const STATUS_TONE: Record<TemplateStatus, Tone> = {
  draft: "caution",
  approved: "positive",
  retired: "neutral",
};

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "approved", label: "Approved" },
  { value: "retired", label: "Retired" },
];

const TIERS: readonly SeasonDay[] = [1, 2, 3];

/** Columns in the pool table, for the rows that span all of them. */
const POOL_COLUMNS = 8;

// Mirrors GenerateTasksDto so a bad batch is caught before the round trip.
const COUNT_MIN = 1;
const COUNT_MAX = 20;
const COUNT_DEFAULT = 5;
const STEER_MAX = 500;

function isStatus(value: string | null): value is TemplateStatus {
  return (TEMPLATE_STATUSES as readonly string[]).includes(value ?? "");
}

/**
 * The task pool: what the Charter has produced, what is waiting to be
 * approved, and what is live. Two model agents write drafts; a person still
 * puts each one into the pool, and that is the only step that publishes.
 */
export function TasksTab() {
  const params = useSearchParams();
  // The overview links here with ?status=approved; anything else is "all".
  const [status, setStatus] = useState<StatusFilter>(() => {
    const wanted = params.get("status");
    return isStatus(wanted) ? wanted : "all";
  });
  const [tier, setTier] = useState<TierFilter>("all");

  const stats = useAsync(() => gameApi.getCharterStats(), []);
  const list = useAsync(
    () =>
      gameApi.listTemplates({
        status: status === "all" ? undefined : status,
        tier: tier === "all" ? undefined : tier,
      }),
    [status, tier],
  );

  const reloadAll = () => {
    list.reload();
    stats.reload();
  };
  const { note, busy, act } = useAction(reloadAll);
  // Which row is mid-action, so a slow reviewer call shows where it is.
  const [pending, setPending] = useState<{
    id: string;
    action: RowAction;
  } | null>(null);

  async function run(
    template: GameTaskTemplate,
    action: RowAction,
    call: () => Promise<unknown>,
    done: string,
  ) {
    setPending({ id: template.id, action });
    await act(call, done);
    setPending(null);
  }

  const rows = list.data?.templates ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PoolStats stats={stats} />

      <GenerateSection onDone={reloadAll} />

      {/* ------------------------------------------------------- the pool */}
      <Panel
        title="The pool"
        aside={
          <span className="tnum text-[11px] text-faint">
            {list.data ? `${rows.length} shown` : ""}
          </span>
        }
        bleed
      >
        <div className="flex flex-col gap-4 px-5 pb-4">
          <p className="max-w-2xl text-[12px] leading-6 text-muted">
            Approving re-runs the safety screen and refuses a draft the
            reviewer rejected until it is reviewed again. Retiring takes a task
            out of rotation and keeps it on record, so every hand-in keeps its
            meaning. Nothing here is ever deleted.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Filter by status"
              className="flex flex-wrap gap-2"
            >
              {STATUS_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setStatus(chip.value)}
                  aria-pressed={status === chip.value}
                  className={chipCls(status === chip.value)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <span className={labelCls}>Tier</span>
              <span className="block w-36">
                <select
                  aria-label="Filter by tier"
                  value={tier === "all" ? "all" : String(tier)}
                  onChange={(e) =>
                    setTier(
                      e.target.value === "all"
                        ? "all"
                        : (Number(e.target.value) as SeasonDay),
                    )
                  }
                  className={selectCls}
                >
                  <option value="all">All tiers</option>
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      Tier {t}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </div>

          <Note>{note}</Note>
        </div>

        {list.loading && (
          <div className="px-5 pb-5">
            <Loading label="Loading tasks" />
          </div>
        )}
        {list.error && (
          <div className="px-5 pb-5">
            <ErrorNote message={list.error} />
          </div>
        )}
        {list.data && rows.length === 0 && (
          <Empty>
            {status === "all" && tier === "all"
              ? "The pool is empty. Generate a batch above, then approve what holds up."
              : "Nothing matches these filters."}
          </Empty>
        )}

        {rows.length > 0 && (
          <TableScroll>
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr className="border-t border-line">
                  <th scope="col" className={thCls}>
                    Task
                  </th>
                  <th scope="col" className={thCls}>
                    Tier
                  </th>
                  <th scope="col" className={thCls}>
                    Mode
                  </th>
                  <th scope="col" className={thCls}>
                    Clock
                  </th>
                  <th scope="col" className={thCls}>
                    Reward
                  </th>
                  <th scope="col" className={thCls}>
                    Reviewer
                  </th>
                  <th scope="col" className={thCls}>
                    Status
                  </th>
                  <th scope="col" className={`${thCls} text-right`}>
                    Actions
                  </th>
                </tr>
              </thead>
              {rows.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  busy={busy}
                  pending={pending?.id === template.id ? pending.action : null}
                  onApprove={() =>
                    run(
                      template,
                      "approve",
                      () => gameApi.approveTemplate(template.id),
                      `“${template.title}” is in the pool.`,
                    )
                  }
                  onReview={() =>
                    run(
                      template,
                      "review",
                      () => gameApi.reviewTemplate(template.id),
                      `“${template.title}” reviewed again. The verdict is on the row.`,
                    )
                  }
                  onRetire={() =>
                    run(
                      template,
                      "retire",
                      () => gameApi.retireTemplate(template.id),
                      `“${template.title}” is retired. It stays on record.`,
                    )
                  }
                />
              ))}
            </table>
          </TableScroll>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- stats --

function PoolStats({
  stats,
}: {
  stats: ReturnType<typeof useAsync<Awaited<ReturnType<typeof gameApi.getCharterStats>>>>;
}) {
  const data = stats.data;
  const attempts = (data?.generated ?? 0) + (data?.rejected ?? 0);
  const rate =
    data && attempts > 0 ? Math.round((data.rejected / attempts) * 100) : null;
  const categories = data
    ? Object.entries(data.byCategory).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <>
      {stats.error && <ErrorNote message={stats.error} />}

      <div
        className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}
      >
        <div className="p-5">
          <Stat
            label="Charter"
            value={
              <span className="font-mono text-[18px]">
                {data ? shortId(data.charterHash) : "…"}
              </span>
            }
            hint="hash of the rules the creator reads"
          />
        </div>
        <div className="p-5">
          <Stat
            label="Generated"
            value={data?.generated ?? "…"}
            hint="drafts filed under this Charter"
          />
        </div>
        <div className="p-5">
          <Stat
            label="Rejected"
            value={data?.rejected ?? "…"}
            hint="refusals by the screen or the reviewer"
          />
        </div>
        <div className="p-5">
          <Stat
            label="Rejection rate"
            value={rate == null ? "—" : `${rate}%`}
            hint="of everything the creator wrote"
          />
        </div>
      </div>

      <Panel eyebrow="The Charter in force" title="Refusals by category">
        <div className="flex flex-col gap-3">
          {categories.length > 0 && (
            <div
              className="flex flex-wrap gap-2"
              aria-label="Rejections by category"
            >
              {categories.map(([category, count]) => (
                <Pill key={category}>
                  {words(category)}: {count}
                </Pill>
              ))}
            </div>
          )}
          <p className="max-w-2xl text-[12px] leading-6 text-muted">
            Watch the rate per category: a rule that never fires is unnecessary
            or broken; one that fires on most generations means the Charter is
            not carrying it.
          </p>
        </div>
      </Panel>
    </>
  );
}

// ------------------------------------------------------------------ row --

function TemplateRow({
  template,
  busy,
  pending,
  onApprove,
  onReview,
  onRetire,
}: {
  template: GameTaskTemplate;
  busy: boolean;
  pending: RowAction | null;
  onApprove: () => void | Promise<void>;
  onReview: () => void | Promise<void>;
  onRetire: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const t = template;
  const rejected = t.review?.verdict === "reject";
  const detailsId = `task-${t.id}-details`;

  return (
    <tbody className="align-top">
      <tr className={trCls}>
        <td className={tdCls}>
          <p className="text-[13px] font-bold leading-5">{t.title}</p>
          <p className="mt-0.5 text-[11px] leading-5 text-faint">
            <span className="font-mono">{t.slug}</span> ·{" "}
            {t.origin === "generated"
              ? `generated${t.model ? ` · ${t.model}` : ""}`
              : "human"}{" "}
            · {timeAgo(t.createdAt)}
          </p>
        </td>
        <td className={`${tdCls} tnum`}>{t.tier}</td>
        <td className={tdCls}>
          {t.mode}
          <span className="block text-[11px] text-faint">
            proof: {t.proof}
          </span>
        </td>
        <td className={`${tdCls} tnum whitespace-nowrap`}>
          {t.clockMinutes} min
        </td>
        <td className={`${tdCls} tnum whitespace-nowrap`}>
          +{t.rewardNerve} Nerve
          <span className="block text-[11px] text-faint">
            +{t.rewardCoins} coins
            {t.mode === "team" && ` · penalty ${t.penaltyCoins}`}
          </span>
        </td>
        <td className={tdCls}>
          {t.review ? (
            <>
              <Pill tone={rejected ? "danger" : "positive"}>
                {t.review.verdict}
              </Pill>
              <span className="mt-1 block text-[11px] text-faint">
                severity {t.review.severity} · round {t.review.round}
              </span>
            </>
          ) : (
            <span className="text-faint">—</span>
          )}
        </td>
        <td className={tdCls}>
          <Pill tone={STATUS_TONE[t.status]}>{t.status}</Pill>
        </td>
        <td className={`${tdCls} text-right`}>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={detailsId}
              className={btnGhost}
            >
              {open ? "Collapse" : "Expand"}
            </button>
            {t.status === "draft" && (
              <button
                type="button"
                disabled={busy || rejected}
                onClick={onApprove}
                className={btnGhost}
              >
                {pending === "approve" ? "Approving…" : "Approve"}
              </button>
            )}
            {t.status !== "retired" && (
              <button
                type="button"
                disabled={busy}
                onClick={onReview}
                className={btnGhost}
              >
                {pending === "review" ? "Reviewing…" : "Re-review"}
              </button>
            )}
            {t.status === "approved" && (
              <ConfirmButton
                label={pending === "retire" ? "Retiring…" : "Retire"}
                confirmLabel="Retire it? It leaves rotation for good."
                disabled={busy}
                onConfirm={onRetire}
              />
            )}
          </div>
          {t.status === "draft" && rejected && (
            <p className="mt-1 text-[11px] leading-5 text-faint">
              Rejected by the reviewer — re-review first
            </p>
          )}
        </td>
      </tr>

      {/* The reviewer's refusal stays on the row: it is the reason the
          approve button is disabled, so it cannot hide behind a toggle. */}
      {rejected && t.review && (
        <tr>
          <td colSpan={POOL_COLUMNS} className="px-5 pb-3.5">
            <div className="rounded-[var(--radius-control)] border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-[12px] leading-5 text-danger">
              {t.review.blockedTypes.length > 0 && (
                <p>Blocked: {t.review.blockedTypes.map(words).join(", ")}</p>
              )}
              {t.review.reasons.length > 0 && (
                <ul className="list-disc pl-4">
                  {t.review.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              )}
              {t.review.feedback && (
                <p className="mt-1">{t.review.feedback}</p>
              )}
            </div>
          </td>
        </tr>
      )}

      {open && (
        <tr>
          <td colSpan={POOL_COLUMNS} className="px-5 pb-5">
            <div
              id={detailsId}
              className="flex flex-col gap-4 rounded-[var(--radius-control)] border border-line bg-raised p-4"
            >
              <div>
                <p className={labelCls}>Brief</p>
                <p className="mt-1 max-w-3xl whitespace-pre-wrap text-[13px] leading-6">
                  {t.brief}
                </p>
              </div>

              {t.guards.length > 0 && (
                <div>
                  <p className={labelCls}>Guards</p>
                  <ul className="mt-1 list-disc pl-4 text-[12px] leading-5">
                    {t.guards.map((guard, i) => (
                      <li key={i}>{guard}</li>
                    ))}
                  </ul>
                </div>
              )}

              {t.criteria.length > 0 && (
                <div>
                  <p className={labelCls}>Criteria</p>
                  <div className="mt-1 overflow-x-auto">
                    <table className="w-full min-w-[32rem] text-left text-[12px]">
                      <thead className={theadCls}>
                        <tr>
                          <th scope="col" className="py-2 pr-4 font-bold">
                            Id
                          </th>
                          <th scope="col" className="py-2 pr-4 font-bold">
                            Modality
                          </th>
                          <th scope="col" className="py-2 pr-4 font-bold">
                            Required
                          </th>
                          <th scope="col" className="py-2 font-bold">
                            Assert
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.criteria.map((c) => (
                          <tr key={c.id} className="border-t border-line align-top">
                            <td className="py-2 pr-4 font-mono">{c.id}</td>
                            <td className="py-2 pr-4">{c.modality}</td>
                            <td className="py-2 pr-4">
                              {c.required ? "yes" : "no"}
                            </td>
                            <td className="py-2 leading-5">{c.assert}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {t.rationale && (
                <div>
                  <p className={labelCls}>Rationale</p>
                  <p className="mt-1 max-w-3xl text-[12px] leading-6">
                    {t.rationale}
                  </p>
                </div>
              )}

              <Facts
                rows={[
                  {
                    label: "Charter",
                    value: (
                      <span className="font-mono">{shortId(t.charterHash)}</span>
                    ),
                  },
                  ...(t.review
                    ? [
                        {
                          label: "Reviewed",
                          value: `${formatDateTime(t.review.reviewedAt)}${
                            t.review.model ? ` · ${t.review.model}` : ""
                          }`,
                        },
                      ]
                    : []),
                  {
                    label: "Approved",
                    value: t.approvedAt
                      ? `${formatDateTime(t.approvedAt)} by ${shortId(t.approvedBy)}`
                      : "—",
                  },
                  { label: "Created", value: formatDateTime(t.createdAt) },
                  { label: "Id", value: <span className="font-mono">{t.id}</span> },
                ]}
              />
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}

// ------------------------------------------------------------- generate --

function GenerateSection({ onDone }: { onDone: () => void }) {
  const { note, busy, act } = useAction(onDone);
  const [result, setResult] = useState<GenerateTasksResult | null>(null);

  const [tier, setTier] = useState<SeasonDay>(1);
  const [count, setCount] = useState(String(COUNT_DEFAULT));
  const [mode, setMode] = useState<ModeChoice>("any");
  const [steer, setSteer] = useState("");
  const [avoid, setAvoid] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(count);
    const direction = steer.trim();
    if (!Number.isInteger(n) || n < COUNT_MIN || n > COUNT_MAX) {
      setProblem(`Count must be a whole number from ${COUNT_MIN} to ${COUNT_MAX}.`);
      return;
    }
    if (direction.length > STEER_MAX) {
      setProblem(`Steer is limited to ${STEER_MAX} characters.`);
      return;
    }
    setProblem(null);
    const slugs = avoid
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setResult(null);
    void act(
      () =>
        gameApi.generateTasks({
          tier,
          count: n,
          // "any" lets the creator mix; the DTO treats an absent mode as that.
          mode: mode === "any" ? undefined : mode,
          steer: direction || undefined,
          avoid: slugs.length > 0 ? slugs : undefined,
        }),
      (r) => {
        const out = r as GenerateTasksResult;
        setResult(out);
        return `${out.saved.length} saved as drafts, ${out.rejected.length} refused, ${out.dropped} slot${out.dropped === 1 ? "" : "s"} dropped. Nothing is live until you approve it.`;
      },
    );
  }

  return (
    <>
      <Panel eyebrow="Creator and reviewer" title="Write a batch">
        <p className="mb-5 max-w-2xl text-[12px] leading-6 text-muted">
          The creator drafts, the screen and the reviewer refuse, and a refusal
          goes back for a different task. Survivors are filed as drafts below.
          Generation publishes nothing; approval is a separate, human act.
        </p>

        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="gen-tier" label="Tier">
              <select
                id="gen-tier"
                value={tier}
                onChange={(e) => setTier(Number(e.target.value) as SeasonDay)}
                className={selectCls}
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    Tier {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="gen-count" label="Count">
              <input
                id="gen-count"
                type="number"
                inputMode="numeric"
                min={COUNT_MIN}
                max={COUNT_MAX}
                step={1}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field id="gen-mode" label="Mode">
              <select
                id="gen-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as ModeChoice)}
                className={selectCls}
              >
                <option value="any">Any</option>
                <option value="solo">Solo</option>
                <option value="team">Team</option>
              </select>
            </Field>

            <div className="sm:col-span-2">
              <Field id="gen-steer" label="Steer (optional)">
                <textarea
                  id="gen-steer"
                  value={steer}
                  onChange={(e) => setSteer(e.target.value)}
                  maxLength={STEER_MAX}
                  rows={3}
                  placeholder="more indoor tasks, none involving strangers"
                  aria-describedby="gen-steer-hint"
                  className={textareaCls}
                />
                <p
                  id="gen-steer-hint"
                  className="text-[11px] leading-5 text-faint"
                >
                  {steer.length} / {STEER_MAX}. Direction for the creator, not a
                  way round the Charter.
                </p>
              </Field>
            </div>
            <Field id="gen-avoid" label="Avoid slugs (optional)">
              <input
                id="gen-avoid"
                value={avoid}
                onChange={(e) => setAvoid(e.target.value)}
                placeholder="hum-in-the-lift, mirror-compliment"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-describedby="gen-avoid-hint"
                className={inputCls}
              />
              <p
                id="gen-avoid-hint"
                className="text-[11px] leading-5 text-faint"
              >
                Comma-separated. The live pool&apos;s slugs are added
                automatically.
              </p>
            </Field>
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-end gap-4">
              <p
                aria-live="polite"
                className="mr-auto min-h-5 text-[12px] leading-5 text-danger"
              >
                {problem}
              </p>
              {busy && (
                <span className="text-[12px] leading-5 text-muted">
                  Writing and reviewing. This takes a minute or two.
                </span>
              )}
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? "Writing…" : "Write the batch"}
              </button>
            </div>
            <Note>{note}</Note>
          </div>
        </form>
      </Panel>

      {result && <GenerateResult result={result} />}
    </>
  );
}

function GenerateResult({ result }: { result: GenerateTasksResult }) {
  return (
    <Panel eyebrow="Last batch" title="What the run produced" bleed>
      <div className="grid grid-cols-2 gap-x-6 gap-y-7 border-t border-line p-5 sm:grid-cols-4">
        <Stat label="Saved" value={result.saved.length} hint="filed as drafts" />
        <Stat
          label="Refused"
          value={result.rejected.length}
          hint={`${result.rejectionsStored} kept on record`}
        />
        <Stat label="Dropped" value={result.dropped} hint="slots never filled" />
        <Stat
          label="Rounds"
          value={`${result.rounds} / ${result.maxRounds}`}
          hint="used / allowed"
        />
      </div>

      <div className="border-t border-line p-5">
        <Facts
          rows={[
            {
              label: "Charter",
              value: (
                <span className="font-mono">{shortId(result.charterHash)}</span>
              ),
            },
            { label: "Creator", value: result.models.creator ?? "—" },
            { label: "Reviewer", value: result.models.reviewer ?? "—" },
            {
              label: "Tokens",
              value: (
                <span className="tnum">
                  {result.usage.inputTokens.toLocaleString("en-GB")} in ·{" "}
                  {result.usage.outputTokens.toLocaleString("en-GB")} out ·{" "}
                  {result.usage.cacheReadTokens.toLocaleString("en-GB")} cache
                  read
                </span>
              ),
            },
            {
              label: "Skipped",
              value:
                result.skipped.length > 0 ? (
                  <span className="font-mono">{result.skipped.join(", ")}</span>
                ) : (
                  "none"
                ),
            },
          ]}
        />
      </div>

      {result.saved.length > 0 && (
        <section className="border-t border-line pt-4">
          <p className={`${eyebrow} px-5 pb-1`}>Saved as drafts</p>
          <ul>
            {result.saved.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3"
              >
                <span className="text-[13px] font-bold">{t.title}</span>
                <span className="font-mono text-[11px] text-faint">
                  {t.slug}
                </span>
                <Pill tone="outline">tier {t.tier}</Pill>
                <span className="text-[11px] text-faint">{t.mode}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.rejected.length > 0 && (
        <section className="border-t border-line pt-4">
          <p className={`${eyebrow} px-5 pb-1`}>Refused along the way</p>
          <ul>
            {result.rejected.map((r, i) => {
              const violations = r.violations
                .map((v) => [v.id, v.label].filter(Boolean).join(" — "))
                .filter(Boolean);
              return (
                <li
                  key={`${r.task.slug}-${r.round}-${i}`}
                  className="border-t border-line px-5 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-bold">{r.task.title}</span>
                    <span className="font-mono text-[11px] text-faint">
                      {r.task.slug}
                    </span>
                    <Pill tone={r.source === "screen" ? "neutral" : "danger"}>
                      {r.source}
                    </Pill>
                    <span className="tnum text-[11px] text-faint">
                      round {r.round}
                    </span>
                  </div>
                  {violations.length > 0 && (
                    <p className="mt-2 text-[12px] leading-5 text-muted">
                      Violations: {violations.map(words).join("; ")}
                    </p>
                  )}
                  {r.review && r.review.reasons.length > 0 && (
                    <ul className="mt-1 list-disc pl-4 text-[12px] leading-5 text-muted">
                      {r.review.reasons.map((reason, j) => (
                        <li key={j}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  {r.feedback && (
                    <p className="mt-2 max-w-3xl rounded-[var(--radius-control)] border border-line bg-raised px-3.5 py-2.5 text-[12px] leading-5 text-ink">
                      {r.feedback}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="max-w-2xl border-t border-line px-5 py-4 text-[12px] leading-6 text-muted">
        Nothing above is live. Each saved draft is in the pool list below
        with the reviewer&apos;s verdict on it; approve the ones that hold up.
      </p>
    </Panel>
  );
}
