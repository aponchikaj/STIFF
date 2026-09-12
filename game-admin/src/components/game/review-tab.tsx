"use client";

import { useState } from "react";
import { ApiError, gameApi } from "@/lib/api";
import type {
  CheatVerdictKind,
  ReviewAttempt,
  SeasonDay,
  SettleInput,
} from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  btnOutline,
  btnSolidSm,
  chipCls,
  ErrorNote,
  Field,
  inputCls,
  labelCls,
  Loading,
  textareaCls,
} from "../ui";
import {
  ConfirmButton,
  Empty,
  Facts,
  Note,
  Pill,
  SectionTitle,
  durationWords,
  formatDateTime,
  shortId,
  timeAgo,
  useAction,
  words,
} from "./game-ui";

const DAYS: readonly SeasonDay[] = [1, 2, 3];
const LIMIT = 50;
const MAX_NERVE = 10_000;
const MAX_REASON = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VERDICT_TONE: Record<CheatVerdictKind, "neutral" | "outline" | "warn"> =
  {
    cheating: "warn",
    suspicious: "outline",
    authentic: "neutral",
    unchecked: "neutral",
  };

/**
 * The review queue: every hand-in waiting for a verdict, oldest first, with
 * the media, what the model thought, and the two buttons that settle it.
 * Settling is the only thing that puts an attempt in the feed and pays it,
 * so this screen is where the season's score is actually made.
 */
export function ReviewTab() {
  const [day, setDay] = useState<SeasonDay | undefined>(undefined);
  const queue = useAsync(
    () => gameApi.getReviewQueue({ day, limit: LIMIT }),
    [day],
  );
  const { note, setNote, busy, act } = useAction(queue.reload);

  /**
   * Two admins can open the same item; the backend claims the transition
   * and answers the loser with a 409. The note says so, and the queue is
   * reloaded on that path too so the settled item stops being offered.
   */
  function settle(item: ReviewAttempt, input: SettleInput, done: string) {
    return act(
      () =>
        gameApi.settleAttempt(item.id, input).catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 409) queue.reload();
          throw err;
        }),
      done,
    );
  }

  const items = queue.data?.items ?? [];

  return (
    <div className="space-y-12">
      <section>
        <SectionTitle
          aside={
            queue.data && (
              <span className="text-xs tabular-nums text-muted">
                {queue.data.total} waiting
                {queue.data.total > items.length &&
                  ` · showing the oldest ${items.length}`}
              </span>
            )
          }
        >
          Waiting for a verdict
        </SectionTitle>

        <div
          role="group"
          aria-label="Filter by day"
          className="flex flex-wrap gap-2"
        >
          <button
            type="button"
            onClick={() => setDay(undefined)}
            className={chipCls(day === undefined)}
            aria-pressed={day === undefined}
          >
            All
          </button>
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={chipCls(day === d)}
              aria-pressed={day === d}
            >
              Day {d}
            </button>
          ))}
        </div>
        <Note>{note}</Note>

        {queue.loading && !queue.data && <Loading label="Loading the queue" />}
        {queue.error && <ErrorNote message={queue.error} />}
        {queue.data && items.length === 0 && <Empty>The queue is clear.</Empty>}

        <ul className="mt-4 border-t border-subtle">
          {items.map((item) => (
            <ReviewItem
              key={item.id}
              item={item}
              busy={busy}
              onSettle={(input, done) => settle(item, input, done)}
              onInvalid={setNote}
            />
          ))}
        </ul>
      </section>

      <Unpublish
        busy={busy}
        onUnpublish={(id) =>
          act(
            () => gameApi.unpublishAttempt(id),
            `Took ${shortId(id)} out of the feed and clawed back the Nerve it paid.`,
          )
        }
      />
    </div>
  );
}

// ------------------------------------------------------------------ item --

function ReviewItem({
  item,
  busy,
  onSettle,
  onInvalid,
}: {
  item: ReviewAttempt;
  busy: boolean;
  onSettle: (input: SettleInput, done: string) => Promise<void>;
  onInvalid: (message: string) => void;
}) {
  const [nerve, setNerve] = useState("");
  const [reason, setReason] = useState("");
  const [burnHeart, setBurnHeart] = useState(false);

  const handle = item.enrolment.handle;
  const thing = item.kind === "video" ? "clip" : "photo";
  const submitted = item.submittedAt ?? item.createdAt;

  function approve() {
    const raw = nerve.trim();
    if (raw === "") {
      void onSettle(
        { verdict: "approve" },
        `Approved ${handle}'s day ${item.day} ${thing} — paid the task's reward.`,
      );
      return;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > MAX_NERVE) {
      onInvalid(`Nerve must be a whole number from 0 to ${MAX_NERVE}.`);
      return;
    }
    void onSettle(
      { verdict: "approve", nerve: value },
      `Approved ${handle}'s day ${item.day} ${thing}, +${value} Nerve.`,
    );
  }

  function reject() {
    const trimmed = reason.trim();
    void onSettle(
      {
        verdict: "reject",
        reason: trimmed || undefined,
        burnHeart: burnHeart || undefined,
      },
      `Rejected ${handle}'s day ${item.day} ${thing}${burnHeart ? " and burned a heart" : ""}.`,
    );
  }

  return (
    <li className="border-b border-subtle py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="flex flex-wrap items-baseline gap-2 text-sm">
          <span className="font-bold uppercase tracking-wide">{handle}</span>
          <span className="text-xs tabular-nums text-muted">
            {item.enrolment.nerve} Nerve
          </span>
          <Pill tone="outline">day {item.day}</Pill>
          <Pill>{item.kind}</Pill>
        </p>
        <p className="text-xs text-muted">
          <time dateTime={submitted}>{formatDateTime(submitted)}</time> ·{" "}
          {timeAgo(submitted)}
        </p>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Media item={item} />
          {item.caption ? (
            <p className="text-sm leading-6">{item.caption}</p>
          ) : (
            <p className="text-xs text-muted">No caption.</p>
          )}
          <Facts
            rows={[
              {
                label: "Size",
                value:
                  item.width && item.height
                    ? `${item.width}×${item.height}`
                    : "—",
              },
              ...(item.kind === "video"
                ? [
                    {
                      label: "Length",
                      value:
                        item.durationSeconds != null
                          ? durationWords(item.durationSeconds)
                          : "—",
                    },
                  ]
                : []),
              { label: "File", value: `${megabytes(item.byteSize)} MB` },
              {
                label: "Attempt",
                value: <span className="font-mono">{item.id}</span>,
              },
            ]}
          />
        </div>

        <div className="min-w-0 space-y-6">
          <ModelVerdict item={item} />

          <div className="space-y-4 border-t border-subtle pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <Field id={`nerve-${item.id}`} label="Nerve override">
                  <input
                    id={`nerve-${item.id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_NERVE}
                    step={1}
                    value={nerve}
                    onChange={(e) => setNerve(e.target.value)}
                    placeholder="task's reward"
                    className={inputCls}
                  />
                </Field>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={approve}
                className={`${btnSolidSm} h-12`}
              >
                Approve
              </button>
            </div>
            <p className="text-xs text-muted">
              Leave the override blank to pay what the task promises. A clan
              hand-in always pays the task&apos;s reward to both members.
            </p>
          </div>

          <div className="space-y-3 border-t border-subtle pt-4">
            <Field id={`reason-${item.id}`} label="Reason for rejecting">
              <textarea
                id={`reason-${item.id}`}
                rows={2}
                maxLength={MAX_REASON}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="The player reads this. Say what was missing."
                className={textareaCls}
              />
            </Field>
            <p className="text-right text-[10px] tabular-nums text-muted">
              {reason.length}/{MAX_REASON}
            </p>
            <label className="flex items-start gap-3 text-xs leading-5">
              <input
                type="checkbox"
                checked={burnHeart}
                onChange={(e) => setBurnHeart(e.target.checked)}
                className="mt-1 size-3.5 accent-current"
              />
              <span>
                <span className={labelCls}>Burn a heart</span>
                <br />
                <span className="text-muted">
                  One-way — a burned heart never comes back, and if it was
                  their last, their season ends here and they become a
                  watcher.
                </span>
              </span>
            </label>
            <ConfirmButton
              label={burnHeart ? "Reject and burn a heart" : "Reject"}
              confirmLabel={
                burnHeart ? "Burn it — sure?" : "Reject — sure?"
              }
              onConfirm={reject}
              disabled={busy}
              className={btnOutline}
            />
          </div>
        </div>
      </div>
    </li>
  );
}

// ----------------------------------------------------------------- media --

function Media({ item }: { item: ReviewAttempt }) {
  if (!item.mediaUrl) {
    // The bucket may not be public-readable yet; the key still lets someone
    // find the object by hand.
    return (
      <div className="rounded-[2px] border border-subtle p-4">
        <p className={labelCls}>No public URL</p>
        <p className="mt-2 break-all font-mono text-xs">{item.objectKey}</p>
      </div>
    );
  }
  const alt = item.caption
    ? `${item.enrolment.handle}: ${item.caption}`
    : `Hand-in by ${item.enrolment.handle}`;
  return (
    <div className="flex items-center justify-center rounded-[2px] bg-black">
      {item.kind === "video" ? (
        <video
          controls
          preload="metadata"
          src={item.mediaUrl}
          aria-label={alt}
          className="max-h-80 w-full object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- media lives on an external bucket next/image cannot optimise
        <img
          src={item.mediaUrl}
          alt={alt}
          loading="lazy"
          className="max-h-80 w-full object-contain"
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------- verdict --

function ModelVerdict({ item }: { item: ReviewAttempt }) {
  const v = item.aiVerdict;
  return (
    <div>
      <p className={labelCls}>What the model thought</p>
      {!v ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          <Pill>not checked</Pill>
          <span>No verdict was written for this hand-in.</span>
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-xs">
            <Pill tone={VERDICT_TONE[v.verdict]}>{v.verdict}</Pill>
            <span className="tabular-nums">
              {Math.round(v.confidence * 100)}% sure
            </span>
            <span className="text-muted">
              · {v.mode} · {v.enforced ? "enforced" : "not enforced"}
              {v.skipped && ` · skipped: ${words(v.skipped)}`}
              {v.model && ` · ${v.model}`}
            </span>
          </p>
          {v.reasons.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs leading-5">
              {v.reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          )}
          {v.signals && v.signals.length > 0 && (
            <p className="flex flex-wrap gap-1.5">
              {v.signals.map((signal, i) => (
                <Pill key={i}>{signal}</Pill>
              ))}
            </p>
          )}
        </div>
      )}

      {item.votingStatus !== "none" && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Pill tone={item.votingStatus === "deferred" ? "outline" : "neutral"}>
            vote {item.votingStatus}
          </Pill>
          {item.voting ? (
            <span className="tabular-nums">
              {item.voting.yes} yes · {item.voting.no} no ·{" "}
              {words(item.voting.outcome)}
            </span>
          ) : (
            item.votingEndsAt && (
              <span>closes {formatDateTime(item.votingEndsAt)}</span>
            )
          )}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------- unpublish --

function Unpublish({
  busy,
  onUnpublish,
}: {
  busy: boolean;
  onUnpublish: (id: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const id = value.trim();
  const valid = UUID.test(id);

  return (
    <section>
      <SectionTitle>Take a hand-in out of the feed</SectionTitle>
      <p className="max-w-2xl text-xs leading-6 text-muted">
        Removes a published attempt from the feed and claws back the Nerve it
        paid through the score ledger, so the board corrects itself. Coins are
        not touched, and the attempt is not deleted.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-md">
          <Field id="unpublish-attempt-id" label="Attempt id">
            <input
              id="unpublish-attempt-id"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className={`${inputCls} font-mono`}
            />
          </Field>
        </div>
        <ConfirmButton
          label="Unpublish"
          confirmLabel="Out of the feed — sure?"
          disabled={busy || !valid}
          onConfirm={async () => {
            await onUnpublish(id);
            setValue("");
          }}
          className={`${btnOutline} h-12`}
        />
      </div>
    </section>
  );
}

// --------------------------------------------------------------- helpers --

function megabytes(bytes: number): string {
  const mb = bytes / 1_048_576;
  return mb < 10 ? mb.toFixed(1) : Math.round(mb).toString();
}
