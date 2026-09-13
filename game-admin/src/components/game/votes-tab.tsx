"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { gameApi } from "@/lib/api";
import type { CheatVerdictKind, VoteRow } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  Badge,
  btnSecondary,
  Card,
  chipCls,
  Empty,
  ErrorNote,
  Loading,
  Note,
  Panel,
  type Tone,
} from "../ui";
import { durationWords, useAction } from "./game-ui";

type VoteFilter = "all" | VoteRow["votingStatus"];

const FILTERS: { value: VoteFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "deferred", label: "Deferred" },
  { value: "resolving", label: "Resolving" },
];

const STATUS_TONE: Record<VoteRow["votingStatus"], Tone> = {
  open: "info",
  deferred: "caution",
  resolving: "neutral",
};

const STATUS_WORD: Record<VoteRow["votingStatus"], string> = {
  open: "Open",
  deferred: "Needs a person",
  resolving: "Resolving",
};

/** Only the verdicts worth a second look get a badge. */
const VERDICT_TONE: Partial<Record<CheatVerdictKind, Tone>> = {
  cheating: "danger",
  suspicious: "caution",
};

/** "closes in 40 min", or "closing" once the window has run out. */
function closesIn(iso: string | null): string {
  if (!iso) return "no close time";
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  if (seconds <= 0) return "closing now";
  return `closes in ${durationWords(seconds)}`;
}

/**
 * Watchers' votes the resolver has not finished with.
 *
 * Most of these need nothing: an open vote closes when its window ends and the
 * resolver decides. The screen is for the deferred ones — a tally too close or
 * too thin to call — and for pushing the resolver when it is behind.
 */
export function VotesTab() {
  // The overview links here as `?status=deferred` — the votes waiting on a
  // person — so the URL decides which list opens first.
  const params = useSearchParams();
  const [filter, setFilter] = useState<VoteFilter>(() => {
    const wanted = params.get("status");
    return wanted === "open" || wanted === "deferred" || wanted === "resolving"
      ? wanted
      : "all";
  });
  const data = useAsync(() => gameApi.listVotes(filter), [filter]);
  const { note, busy, act } = useAction(data.reload);

  const votes = data.data?.votes ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-[12px] leading-6 text-muted">
            Open votes close on their own when the window ends and the resolver
            decides; <strong className="font-semibold text-ink">deferred</strong>{" "}
            ones are waiting on a person, and are settled from the{" "}
            <Link
              href="/review"
              className="font-semibold text-ink underline underline-offset-4"
            >
              Review
            </Link>{" "}
            screen.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              act(
                () => gameApi.resolveVotes(),
                (r) => {
                  const t = r as Awaited<ReturnType<typeof gameApi.resolveVotes>>;
                  return `${t.resolved} resolved, ${t.deferred} deferred, ${t.skipped} skipped.`;
                },
              )
            }
            className={btnSecondary}
          >
            Resolve due votes now
          </button>
        </div>
        {note && (
          <div className="mt-3 border-t border-line pt-3">
            <Note>{note}</Note>
          </div>
        )}
      </Card>

      <Panel
        title="Votes"
        bleed
        aside={
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={chipCls(filter === f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {data.loading && !data.data && (
          <div className="px-5">
            <Loading label="Loading votes" />
          </div>
        )}
        {data.error && (
          <div className="px-5">
            <ErrorNote message={data.error} />
          </div>
        )}
        {data.data && votes.length === 0 && (
          <Empty>
            No votes waiting. When watchers are asked to judge a hand-in, it
            appears here until the resolver has decided it.
          </Empty>
        )}
        <ul>
          {votes.map((vote) => (
            <VoteItem key={vote.attemptId} vote={vote} />
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function VoteItem({ vote }: { vote: VoteRow }) {
  const total = vote.yes + vote.no;
  const yesShare = total === 0 ? 0 : (vote.yes / total) * 100;
  const noShare = total === 0 ? 0 : 100 - yesShare;
  const verdictTone = vote.verdict ? VERDICT_TONE[vote.verdict] : undefined;

  return (
    <li className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-3">
      {vote.mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- media lives on an external bucket next/image cannot optimise
        <img
          src={vote.mediaUrl}
          alt={`${vote.handle}'s ${vote.kind}`}
          loading="lazy"
          className="size-12 shrink-0 rounded-[var(--radius-control)] bg-raised object-cover"
        />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-raised text-[11px] text-faint">
          {vote.kind}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold">{vote.handle}</span>
          <Badge tone={STATUS_TONE[vote.votingStatus]}>
            {STATUS_WORD[vote.votingStatus]}
          </Badge>
          {vote.verdict && verdictTone && (
            <Badge tone={verdictTone}>Model: {vote.verdict}</Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-muted">
          {vote.task ?? "Untitled task"}
        </p>
        <p className="mt-0.5 text-[11px] text-faint">
          Day {vote.day} · {vote.kind}
          {vote.votingStatus === "open" && <> · {closesIn(vote.votingEndsAt)}</>}
        </p>
      </div>

      <div className="flex w-full items-center gap-3 sm:w-64">
        <div
          className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-raised"
          role="img"
          aria-label={`${vote.yes} yes, ${vote.no} no`}
        >
          <div className="bg-positive" style={{ width: `${yesShare}%` }} />
          <div className="bg-danger" style={{ width: `${noShare}%` }} />
        </div>
        <span className="tnum whitespace-nowrap text-[12px] text-muted">
          {vote.yes} yes · {vote.no} no
        </span>
      </div>
    </li>
  );
}
