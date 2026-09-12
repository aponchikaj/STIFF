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
  btnGhostSm,
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
  draft: "neutral",
  approved: "solid",
  retired: "outline",
};

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "approved", label: "Approved" },
  { value: "retired", label: "Retired" },
];

const TIERS: readonly SeasonDay[] = [1, 2, 3];

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
    <div className="space-y-12">
      <PoolStats stats={stats} />

      <GenerateSection onDone={reloadAll} />

      <section>
        <SectionTitle
          aside={
            <span className="text-xs text-muted">
              {list.data ? `${rows.length} shown` : ""}
            </span>
          }
        >
          The pool
        </SectionTitle>
        <p className="mb-4 max-w-2xl text-xs leading-6 text-muted">
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
          </label>
        </div>
        <Note>{note}</Note>

        {list.loading && <Loading label="Loading tasks" />}
        {list.error && <ErrorNote message={list.error} />}
        {list.data && rows.length === 0 && (
          <Empty>
            {status === "all" && tier === "all"
              ? "The pool is empty. Generate a batch above, then approve what holds up."
              : "Nothing matches these filters."}
          </Empty>
        )}

        {rows.length > 0 && (
          <ul className="mt-4 border-t border-subtle">
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
          </ul>
        )}
      </section>
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
    <section>
      <SectionTitle>The Charter in force</SectionTitle>
      {stats.error && <ErrorNote message={stats.error} />}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat
          label="Charter"
          value={
            <span className="font-mono text-2xl">
              {data ? shortId(data.charterHash) : "…"}
            </span>
          }
          hint="hash of the rules the creator reads"
        />
        <Stat
          label="Generated"
          value={data?.generated ?? "…"}
          hint="drafts filed under this Charter"
        />
        <Stat
          label="Rejected"
          value={data?.rejected ?? "…"}
          hint="refusals by the screen or the reviewer"
        />
        <Stat
          label="Rejection rate"
          value={rate == null ? "—" : `${rate}%`}
          hint="of everything the creator wrote"
        />
      </div>
      {categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Rejections by category">
          {categories.map(([category, count]) => (
            <Pill key={category}>
              {words(category)}: {count}
            </Pill>
          ))}
        </div>
      )}
      <p className="mt-3 max-w-2xl text-xs leading-6 text-muted">
        Watch the rate per category: a rule that never fires is unnecessary
        or broken; one that fires on most generations means the Charter is
        not carrying it.
      </p>
    </section>
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
    <li className="border-b border-subtle py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-bold uppercase tracking-wide">
            {t.title}
          </span>
          <span className="font-mono text-xs text-muted">{t.slug}</span>
        </p>
        <span className="flex flex-wrap items-center gap-2">
          <Pill tone={STATUS_TONE[t.status]}>{t.status}</Pill>
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
            {t.origin === "generated"
              ? `generated${t.model ? ` · ${t.model}` : ""}`
              : "human"}{" "}
            · {timeAgo(t.createdAt)}
          </span>
        </span>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Pill tone="outline">tier {t.tier}</Pill>
        <span>{t.mode}</span>
        <span>· proof: {t.proof}</span>
        <span>· {t.clockMinutes} min</span>
        <span>
          · +{t.rewardNerve} Nerve · +{t.rewardCoins} coins
          {t.mode === "team" && ` · penalty ${t.penaltyCoins} coins`}
        </span>
      </p>

      {t.review && (
        <div className="mt-2 text-xs text-muted">
          <p className="flex flex-wrap items-center gap-2">
            <Pill tone={rejected ? "warn" : "neutral"}>
              reviewer: {t.review.verdict}
            </Pill>
            <span>
              severity {t.review.severity} · round {t.review.round}
              {t.review.model && ` · ${t.review.model}`} ·{" "}
              {formatDateTime(t.review.reviewedAt)}
            </span>
          </p>
          {rejected && (
            <>
              {t.review.blockedTypes.length > 0 && (
                <p className="mt-1">
                  blocked: {t.review.blockedTypes.map(words).join(", ")}
                </p>
              )}
              {t.review.reasons.length > 0 && (
                <ul className="mt-1 list-disc pl-4 leading-5">
                  {t.review.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              )}
              {t.review.feedback && (
                <p className="mt-1 leading-5 text-foreground">
                  {t.review.feedback}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={detailsId}
          className={btnGhostSm}
        >
          {open ? "Collapse" : "Expand"}
        </button>
        {t.status === "draft" && (
          <>
            <button
              type="button"
              disabled={busy || rejected}
              onClick={onApprove}
              className={btnGhostSm}
            >
              {pending === "approve" ? "Approving…" : "Approve"}
            </button>
            {rejected && (
              <span className="text-[11px] text-muted">
                Rejected by the reviewer — re-review first
              </span>
            )}
          </>
        )}
        {t.status !== "retired" && (
          <button
            type="button"
            disabled={busy}
            onClick={onReview}
            className={btnGhostSm}
          >
            {pending === "review" ? "Reviewing… (a model call)" : "Re-review"}
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

      {open && (
        <div id={detailsId} className="mt-4 space-y-4 text-xs">
          <div>
            <p className={labelCls}>Brief</p>
            <p className="mt-1 max-w-2xl whitespace-pre-wrap leading-6">
              {t.brief}
            </p>
          </div>

          {t.guards.length > 0 && (
            <div>
              <p className={labelCls}>Guards</p>
              <ul className="mt-1 list-disc pl-4 leading-5">
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
                <table className="w-full min-w-[32rem] border-t border-subtle text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.15em] text-muted">
                      <th scope="col" className="py-2 pr-4 font-medium">Id</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Modality</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Required</th>
                      <th scope="col" className="py-2 font-medium">Assert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.criteria.map((c) => (
                      <tr key={c.id} className="border-t border-subtle align-top">
                        <td className="py-2 pr-4 font-mono">{c.id}</td>
                        <td className="py-2 pr-4">{c.modality}</td>
                        <td className="py-2 pr-4">{c.required ? "yes" : "no"}</td>
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
              <p className="mt-1 max-w-2xl leading-6">{t.rationale}</p>
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
      )}
    </li>
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
    <section>
      <SectionTitle>Write a batch</SectionTitle>
      <p className="mb-4 max-w-2xl text-xs leading-6 text-muted">
        The creator drafts, the screen and the reviewer refuse, and a refusal
        goes back for a different task. Survivors are filed as drafts below.
        Generation publishes nothing; approval is a separate, human act.
      </p>

      <form
        onSubmit={submit}
        noValidate
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
      >
        <div className="flex flex-wrap gap-5">
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
              className={`${inputCls} h-10 max-w-24`}
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
        </div>

        <div className="flex flex-col gap-5">
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
            <p id="gen-steer-hint" className="text-xs text-muted">
              {steer.length} / {STEER_MAX}. Direction for the creator, not a
              way round the Charter.
            </p>
          </Field>
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
              className={`${inputCls} h-10`}
            />
            <p id="gen-avoid-hint" className="text-xs text-muted">
              Comma-separated. The live pool&apos;s slugs are added
              automatically.
            </p>
          </Field>

          <p aria-live="polite" className="min-h-4 text-xs text-muted">
            {problem}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={busy} className={btnSolidSm}>
              {busy ? "Writing… this takes a minute or two" : "Write the batch"}
            </button>
          </div>
          <Note>{note}</Note>
        </div>
      </form>

      {result && <GenerateResult result={result} />}
    </section>
  );
}

function GenerateResult({ result }: { result: GenerateTasksResult }) {
  return (
    <div className="mt-6 space-y-6 border-t border-subtle pt-6 text-xs">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Saved" value={result.saved.length} hint="filed as drafts" />
        <Stat label="Refused" value={result.rejected.length} hint={`${result.rejectionsStored} kept on record`} />
        <Stat label="Dropped" value={result.dropped} hint="slots never filled" />
        <Stat label="Rounds" value={`${result.rounds} / ${result.maxRounds}`} hint="used / allowed" />
      </div>

      <Facts
        rows={[
          { label: "Charter", value: <span className="font-mono">{shortId(result.charterHash)}</span> },
          { label: "Creator", value: result.models.creator ?? "—" },
          { label: "Reviewer", value: result.models.reviewer ?? "—" },
          {
            label: "Tokens",
            value: `${result.usage.inputTokens.toLocaleString("en-GB")} in · ${result.usage.outputTokens.toLocaleString("en-GB")} out · ${result.usage.cacheReadTokens.toLocaleString("en-GB")} cache read`,
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

      {result.saved.length > 0 && (
        <div>
          <p className={labelCls}>Saved as drafts</p>
          <ul className="mt-2 border-t border-subtle">
            {result.saved.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-baseline gap-2 border-b border-subtle py-2"
              >
                <span className="font-bold uppercase tracking-wide">
                  {t.title}
                </span>
                <span className="font-mono text-muted">{t.slug}</span>
                <Pill tone="outline">tier {t.tier}</Pill>
                <span className="text-muted">{t.mode}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.rejected.length > 0 && (
        <div>
          <p className={labelCls}>Refused along the way</p>
          <ul className="mt-2 border-t border-subtle">
            {result.rejected.map((r, i) => {
              const violations = r.violations
                .map((v) => [v.id, v.label].filter(Boolean).join(" — "))
                .filter(Boolean);
              return (
                <li key={`${r.task.slug}-${r.round}-${i}`} className="border-b border-subtle py-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold uppercase tracking-wide">
                      {r.task.title}
                    </span>
                    <Pill tone={r.source === "screen" ? "outline" : "warn"}>
                      {r.source}
                    </Pill>
                    <span className="text-muted">round {r.round}</span>
                  </p>
                  {violations.length > 0 && (
                    <p className="mt-1 text-muted">
                      violations: {violations.map(words).join("; ")}
                    </p>
                  )}
                  {r.review && r.review.reasons.length > 0 && (
                    <ul className="mt-1 list-disc pl-4 leading-5 text-muted">
                      {r.review.reasons.map((reason, j) => (
                        <li key={j}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  {r.feedback && (
                    <p className="mt-1 max-w-2xl leading-5">{r.feedback}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="max-w-2xl leading-6 text-muted">
        Nothing above is live. Each saved draft is in the pool list below
        with the reviewer&apos;s verdict on it; approve the ones that hold up.
      </p>
    </div>
  );
}
