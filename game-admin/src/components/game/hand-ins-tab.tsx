"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { gameApi } from "@/lib/api";
import type {
  AttemptRow,
  AttemptStatus,
  CheatVerdictKind,
  CommentRow,
  SeasonDay,
} from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  Badge,
  btnDanger,
  btnGhost,
  btnSecondarySm,
  Card,
  cardCls,
  chipCls,
  Empty,
  ErrorNote,
  eyebrow,
  Facts,
  Field,
  labelCls,
  Loading,
  Note,
  Panel,
  selectCls,
  Stat,
  type Tone,
} from "../ui";
import {
  ConfirmButton,
  formatDateTime,
  n,
  timeAgo,
  useAction,
  words,
} from "./game-ui";

const LIMIT = 30;
const DAYS: readonly SeasonDay[] = [1, 2, 3];

type Visibility = "all" | "visible" | "hidden";

const STATUSES: { value: AttemptStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "submitted", label: "Waiting" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
  { value: "awaiting_upload", label: "Not uploaded" },
];

const STATUS_TONE: Record<AttemptStatus, Tone> = {
  submitted: "caution",
  published: "positive",
  rejected: "danger",
  awaiting_upload: "neutral",
};

const STATUS_WORD: Record<AttemptStatus, string> = {
  submitted: "Waiting",
  published: "Published",
  rejected: "Rejected",
  awaiting_upload: "Not uploaded",
};

const VERDICT_TONE: Record<CheatVerdictKind, Tone> = {
  cheating: "danger",
  suspicious: "caution",
  authentic: "neutral",
  unchecked: "neutral",
};

/**
 * Every hand-in in the season, in any state.
 *
 * The review queue shows only what is waiting; this is the archive around
 * it. An operator comes here with a question about something that already
 * happened — a clip that should not be in the feed, a rejection a player is
 * disputing, or everything one player has sent — and leaves with it either
 * answered or taken down.
 */
export function HandInsTab() {
  // Other screens link here with a filter already chosen (the review
  // screen sends `?status=published`), so the URL sets where it starts.
  const params = useSearchParams();
  const [status, setStatus] = useState<AttemptStatus | undefined>(() => {
    const wanted = params.get("status");
    return wanted === "submitted" ||
      wanted === "published" ||
      wanted === "rejected" ||
      wanted === "awaiting_upload"
      ? wanted
      : undefined;
  });
  const [day, setDay] = useState<SeasonDay | undefined>(undefined);
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [player, setPlayer] = useState<{ id: string; handle: string } | null>(
    null,
  );
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const hidden =
    visibility === "hidden" ? true : visibility === "visible" ? false : undefined;

  const list = useAsync(
    () =>
      gameApi.listAttempts({
        status,
        day,
        hidden,
        enrolmentId: player?.id,
        limit: LIMIT,
        offset,
      }),
    [status, day, hidden, player?.id, offset],
  );
  const { note, busy, act } = useAction(list.reload);

  /** Any filter change starts again from the first page, with nothing open. */
  function refilter(apply: () => void) {
    apply();
    setOffset(0);
    setOpenId(null);
  }

  function goTo(next: number) {
    setOffset(Math.max(0, next));
    setOpenId(null);
  }

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const from = items.length === 0 ? 0 : offset + 1;
  const to = offset + items.length;
  const filtered =
    status !== undefined ||
    day !== undefined ||
    visibility !== "all" ||
    player !== null;

  const published = items.filter((a) => a.status === "published").length;
  const rejected = items.filter((a) => a.status === "rejected").length;
  const hiddenCount = items.filter((a) => a.hiddenAt).length;

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}
      >
        <div className="p-5">
          <Stat
            label="Shown"
            value={n(items.length)}
            hint={list.data ? `of ${n(total)} matching` : "on this page"}
          />
        </div>
        <div className="p-5">
          <Stat label="Published" value={n(published)} hint="on this page" />
        </div>
        <div className="p-5">
          <Stat label="Rejected" value={n(rejected)} hint="on this page" />
        </div>
        <div className="p-5">
          <Stat
            label="Hidden"
            value={n(hiddenCount)}
            hint="on this page"
            tone={hiddenCount > 0 ? "caution" : undefined}
          />
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="flex flex-col gap-1.5">
            <span id="hand-ins-status" className={labelCls}>
              Status
            </span>
            <div
              role="group"
              aria-labelledby="hand-ins-status"
              className="flex flex-wrap gap-1.5"
            >
              {STATUSES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => refilter(() => setStatus(s.value))}
                  aria-pressed={status === s.value}
                  className={chipCls(status === s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-32">
            <Field id="hand-ins-day" label="Day">
              <select
                id="hand-ins-day"
                value={day ?? ""}
                onChange={(e) =>
                  refilter(() =>
                    setDay(
                      e.target.value === ""
                        ? undefined
                        : (Number(e.target.value) as SeasonDay),
                    ),
                  )
                }
                className={selectCls}
              >
                <option value="">All days</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    Day {d}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="w-40">
            <Field id="hand-ins-visibility" label="Visibility">
              <select
                id="hand-ins-visibility"
                value={visibility}
                onChange={(e) =>
                  refilter(() => setVisibility(e.target.value as Visibility))
                }
                className={selectCls}
              >
                <option value="all">All</option>
                <option value="visible">Visible only</option>
                <option value="hidden">Hidden only</option>
              </select>
            </Field>
          </div>

          {player && (
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>Player</span>
              <div className="flex h-10 items-center gap-3">
                <Badge tone="solid">{player.handle}</Badge>
                <button
                  type="button"
                  onClick={() => refilter(() => setPlayer(null))}
                  className={btnGhost}
                >
                  Everyone
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Panel
        title="Hand-ins"
        bleed
        aside={
          list.data && (
            <span className="tnum text-[11px] text-faint">
              {total === 0 ? "none" : `${from}–${to} of ${n(total)}`}
            </span>
          )
        }
      >
        {list.loading && !list.data && (
          <div className="px-5">
            <Loading label="Loading hand-ins" />
          </div>
        )}
        {list.error && (
          <div className="px-5">
            <ErrorNote message={list.error} />
          </div>
        )}
        {list.data && items.length === 0 && (
          <div className="border-t border-line">
            <Empty
              action={
                offset > 0 ? (
                  <button
                    type="button"
                    onClick={() => goTo(0)}
                    className={btnSecondarySm}
                  >
                    First page
                  </button>
                ) : filtered ? (
                  <button
                    type="button"
                    onClick={() =>
                      refilter(() => {
                        setStatus(undefined);
                        setDay(undefined);
                        setVisibility("all");
                        setPlayer(null);
                      })
                    }
                    className={btnSecondarySm}
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            >
              {offset > 0
                ? "This page ran past the end — something on it changed since it loaded."
                : filtered
                  ? "Nothing matches these filters."
                  : "No hand-ins yet. Between seasons there is nothing here; once a season runs, every attempt shows up the moment a player starts one."}
            </Empty>
          </div>
        )}

        {items.length > 0 && (
          <ul>
            {items.map((attempt) => (
              <HandInRow
                key={attempt.id}
                attempt={attempt}
                open={openId === attempt.id}
                onToggle={() =>
                  setOpenId((current) =>
                    current === attempt.id ? null : attempt.id,
                  )
                }
                busy={busy}
                onUnpublish={() =>
                  act(
                    () => gameApi.unpublishAttempt(attempt.id),
                    `Took ${attempt.handle}'s day ${attempt.day} ${thing(attempt)} out of the feed and clawed back the Nerve it paid.`,
                  )
                }
                onPlayer={() =>
                  refilter(() =>
                    setPlayer({ id: attempt.enrolmentId, handle: attempt.handle }),
                  )
                }
                filteredToPlayer={player?.id === attempt.enrolmentId}
              />
            ))}
          </ul>
        )}

        {(note || total > LIMIT) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
            <Note>{note}</Note>
            {/* Only when there is a second page to go to. Two disabled buttons
                under an empty list read as a screen that failed to load. */}
            {total > LIMIT && (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                disabled={offset === 0 || list.loading}
                onClick={() => goTo(offset - LIMIT)}
                className={btnSecondarySm}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={offset + LIMIT >= total || list.loading}
                onClick={() => goTo(offset + LIMIT)}
                className={btnSecondarySm}
              >
                Next
              </button>
            </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------- row --

function HandInRow({
  attempt,
  open,
  onToggle,
  busy,
  onUnpublish,
  onPlayer,
  filteredToPlayer,
}: {
  attempt: AttemptRow;
  open: boolean;
  onToggle: () => void;
  busy: boolean;
  onUnpublish: () => Promise<void>;
  onPlayer: () => void;
  filteredToPlayer: boolean;
}) {
  const when = attempt.submittedAt ?? attempt.createdAt;

  return (
    <li className="border-t border-line">
      <div className="flex items-center gap-4 px-5 py-3">
        <Thumb attempt={attempt} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-bold">{attempt.handle}</span>
            <Badge tone={STATUS_TONE[attempt.status]}>
              {STATUS_WORD[attempt.status]}
            </Badge>
            {attempt.hiddenAt && <Badge tone="danger">Hidden</Badge>}
            {attempt.verdict && (
              <Badge tone={VERDICT_TONE[attempt.verdict]}>
                {attempt.verdict}
                {attempt.confidence != null && (
                  <span className="tnum">
                    {" "}
                    {Math.round(attempt.confidence * 100)}%
                  </span>
                )}
              </Badge>
            )}
          </div>
          <p className="mt-1 truncate text-[13px] text-muted">
            {attempt.task ?? "Task no longer on file"}
          </p>
          <p className="tnum mt-0.5 text-[11px] text-faint">
            Day {attempt.day} · {attempt.kind} · {n(attempt.likeCount)}{" "}
            {attempt.likeCount === 1 ? "like" : "likes"} ·{" "}
            {n(attempt.commentCount)}{" "}
            {attempt.commentCount === 1 ? "comment" : "comments"} ·{" "}
            <time dateTime={when}>{timeAgo(when)}</time>
          </p>
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={btnGhost}
        >
          {open ? "Close" : "Open"}
        </button>
      </div>

      {open && (
        <HandInPane
          attempt={attempt}
          busy={busy}
          onUnpublish={onUnpublish}
          onPlayer={onPlayer}
          filteredToPlayer={filteredToPlayer}
        />
      )}
    </li>
  );
}

function Thumb({ attempt }: { attempt: AttemptRow }) {
  const cls =
    "size-14 shrink-0 rounded-[var(--radius-control)] bg-raised object-cover";
  if (!attempt.mediaUrl) {
    return (
      <div
        className={`${cls} flex items-center justify-center border border-line`}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
          {attempt.kind}
        </span>
      </div>
    );
  }
  if (attempt.kind === "video") {
    return (
      <video
        src={attempt.mediaUrl}
        preload="metadata"
        muted
        playsInline
        aria-hidden="true"
        className={cls}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- media lives on an external bucket next/image cannot optimise
    <img src={attempt.mediaUrl} alt="" loading="lazy" className={cls} />
  );
}

// ------------------------------------------------------------------ pane --

function HandInPane({
  attempt,
  busy,
  onUnpublish,
  onPlayer,
  filteredToPlayer,
}: {
  attempt: AttemptRow;
  busy: boolean;
  onUnpublish: () => Promise<void>;
  onPlayer: () => void;
  filteredToPlayer: boolean;
}) {
  return (
    <div className="border-t border-line bg-raised px-5 py-5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* ------------------------------------------------ what they sent */}
        <div className="flex min-w-0 flex-col gap-3">
          <Media attempt={attempt} />
          {attempt.caption ? (
            <p className="text-[13px] leading-6">{attempt.caption}</p>
          ) : (
            <p className="text-[11px] text-faint">No caption.</p>
          )}
          {attempt.status === "rejected" && (
            <div className="rounded-[var(--radius-control)] border border-danger/25 bg-danger-tint px-3.5 py-3">
              <p className={labelCls}>Why it was rejected</p>
              <p className="mt-1.5 text-[13px] leading-6 text-ink">
                {attempt.rejectionReason ?? "No reason was given."}
              </p>
            </div>
          )}
          <Facts
            rows={[
              {
                label: "Submitted",
                value: formatDateTime(attempt.submittedAt),
              },
              {
                label: "Published",
                value: formatDateTime(attempt.publishedAt),
              },
              { label: "Hidden", value: formatDateTime(attempt.hiddenAt) },
              { label: "Vote", value: words(attempt.votingStatus) },
              { label: "Player", value: words(attempt.playerStatus) },
              {
                label: "Attempt",
                value: (
                  <span className="break-all font-mono text-[11px]">
                    {attempt.id}
                  </span>
                ),
              },
            ]}
          />
          {!filteredToPlayer && (
            <div>
              <button type="button" onClick={onPlayer} className={btnGhost}>
                Everything {attempt.handle} handed in
              </button>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {attempt.status === "published" && (
            <div>
              <p className={eyebrow}>Take it down</p>
              <p className="mt-1 text-[12px] leading-5 text-muted">
                It leaves the feed and the Nerve it paid is clawed back through
                the score ledger; coins are not touched.
              </p>
              <div className="mt-2.5">
                <ConfirmButton
                  label="Unpublish"
                  confirmLabel="Out of the feed — sure?"
                  disabled={busy}
                  onConfirm={onUnpublish}
                  className={btnDanger}
                />
              </div>
            </div>
          )}

          <div
            className={
              attempt.status === "published" ? "border-t border-line pt-5" : ""
            }
          >
            <Comments attemptId={attempt.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Media({ attempt }: { attempt: AttemptRow }) {
  if (!attempt.mediaUrl) {
    return (
      <div className="rounded-[var(--radius-control)] border border-line bg-card p-3.5">
        <p className={labelCls}>No media</p>
        <p className="mt-1.5 text-[12px] leading-5 text-muted">
          {attempt.status === "awaiting_upload"
            ? "The upload never finished."
            : "There is no public URL for this file."}
        </p>
      </div>
    );
  }
  const alt = attempt.caption
    ? `${attempt.handle}: ${attempt.caption}`
    : `Hand-in by ${attempt.handle}`;
  return (
    <div className="flex items-center justify-center rounded-[var(--radius-control)] border border-line bg-raised">
      {attempt.kind === "video" ? (
        <video
          controls
          preload="metadata"
          src={attempt.mediaUrl}
          aria-label={alt}
          className="max-h-[360px] w-full rounded-[var(--radius-control)] bg-raised object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- media lives on an external bucket next/image cannot optimise
        <img
          src={attempt.mediaUrl}
          alt={alt}
          loading="lazy"
          className="max-h-[360px] w-full rounded-[var(--radius-control)] bg-raised object-contain"
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------- comments --

function Comments({ attemptId }: { attemptId: string }) {
  const comments = useAsync(() => gameApi.listComments(attemptId), [attemptId]);
  const { note, busy, act } = useAction(comments.reload);
  const rows = comments.data?.comments ?? [];

  function toggle(comment: CommentRow) {
    const hide = !comment.hiddenAt;
    return act(
      () => gameApi.setCommentHidden(comment.id, hide),
      hide
        ? `Hid ${comment.authorHandle}'s comment.`
        : `Restored ${comment.authorHandle}'s comment.`,
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className={eyebrow}>Comments</p>
        {comments.data && (
          <span className="tnum text-[11px] text-faint">{n(rows.length)}</span>
        )}
      </div>
      <p className="mt-1 text-[12px] leading-5 text-muted">
        Hiding is reversible. Deleting is not offered, on purpose.
      </p>

      {comments.loading && !comments.data && (
        <Loading label="Loading comments" />
      )}
      {comments.error && <ErrorNote message={comments.error} />}
      {comments.data && rows.length === 0 && (
        <p className="mt-3 text-[12px] text-faint">
          Nobody has commented on this hand-in.
        </p>
      )}

      {rows.length > 0 && (
        <ul className="mt-3">
          {rows.map((comment) => (
            <li
              key={comment.id}
              className="flex items-start justify-between gap-4 border-t border-line py-3"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold">
                    {comment.authorHandle}
                  </span>
                  <time
                    dateTime={comment.createdAt}
                    className="text-[11px] text-faint"
                  >
                    {timeAgo(comment.createdAt)}
                  </time>
                  {comment.hiddenAt && <Badge tone="danger">Hidden</Badge>}
                </p>
                <p
                  className={`mt-1 break-words text-[13px] leading-6 ${
                    comment.hiddenAt ? "text-muted" : "text-ink"
                  }`}
                >
                  {comment.body}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggle(comment)}
                className={`${btnGhost} shrink-0`}
              >
                {comment.hiddenAt ? "Restore" : "Hide"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2">
        <Note>{note}</Note>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- helpers --

function thing(attempt: AttemptRow): string {
  return attempt.kind === "video" ? "clip" : "photo";
}
