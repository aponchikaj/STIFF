"use client";

import Link from "next/link";
import { gameApi } from "@/lib/api";
import type { GameEnrolment, SeasonStatus } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { btnGhostSm, btnOutline, ErrorNote, Loading } from "../ui";
import {
  Empty,
  Note,
  Pill,
  SectionTitle,
  Stat,
  formatDateTime,
  hearts,
  useAction,
} from "./game-ui";

const SEASON_TONE: Record<SeasonStatus, "neutral" | "solid" | "outline"> = {
  draft: "neutral",
  open: "outline",
  running: "solid",
  closed: "neutral",
};

/**
 * The season at a glance: where it is, who is in it, what is waiting, and
 * the two buttons an operator reaches for at midnight. Every number here is
 * a link to the screen that acts on it.
 */
export function OverviewTab() {
  const season = useAsync(() => gameApi.getSeason(), []);
  const enrolments = useAsync(() => gameApi.listEnrolments({ limit: 500 }), []);
  const review = useAsync(() => gameApi.getReviewQueue({ limit: 200 }), []);
  const reports = useAsync(() => gameApi.getReportStats(), []);
  const drafts = useAsync(() => gameApi.listTemplates({ status: "draft" }), []);
  const approved = useAsync(
    () => gameApi.listTemplates({ status: "approved" }),
    [],
  );
  const board = useAsync(() => gameApi.getLeaderboard({ pageSize: 5 }), []);
  const rules = useAsync(() => gameApi.getRules(), []);

  const reloadAll = () => {
    enrolments.reload();
    review.reload();
    board.reload();
  };
  const { note, busy, act } = useAction(reloadAll);

  if (season.loading) return <Loading label="Loading the season" />;
  if (season.error) return <ErrorNote message={season.error} />;

  const live = season.data?.season ?? null;
  const people = enrolments.data?.enrolments ?? [];
  const counts = tally(people);
  const openReports =
    (reports.data?.byStatus.open ?? 0) + (reports.data?.byStatus.reviewing ?? 0);

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Season
          </p>
          {live ? (
            <>
              <p className="mt-2 text-3xl uppercase tracking-tight">
                {live.title}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <Pill tone={SEASON_TONE[live.status]}>{live.status}</Pill>
                <span>
                  {live.status === "running" && live.startsAt
                    ? `running since ${formatDateTime(live.startsAt)}`
                    : live.status === "open"
                      ? "enrolling — no clock yet"
                      : live.slug}
                </span>
                {/* From the rules endpoint: the public season read does not
                    carry it, and rendering `undefined` here read as a blank. */}
                {rules.data && (
                  <span>· {rules.data.startingHearts} hearts to start</span>
                )}
              </p>
            </>
          ) : (
            <p className="mt-2 max-w-md text-sm leading-6 text-muted">
              No season is open or running. Nobody can enrol and the board is
              empty until one is.{" "}
              <Link href="/game/seasons" className="underline">
                Create or open one.
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || !live}
            onClick={() =>
              act(
                () => gameApi.runSweeps(),
                (r) => {
                  const s = r as Awaited<ReturnType<typeof gameApi.runSweeps>>;
                  return `Sweeps ran: ${s.dailyMinimum.demoted.length} for the daily minimum, ${s.zeroBalance.demoted.length} on zero balance${s.dailyMinimum.skipped ? ` (daily minimum skipped: ${s.dailyMinimum.skipped.replace(/_/g, " ")})` : ""}.`;
                },
              )
            }
            className={btnOutline}
          >
            Run sweeps now
          </button>
          <button
            type="button"
            disabled={busy || !live}
            onClick={() =>
              act(
                () => gameApi.resolveVotes(),
                (r) => {
                  const v = r as Awaited<ReturnType<typeof gameApi.resolveVotes>>;
                  return `Votes: ${v.resolved} resolved, ${v.deferred} deferred to a person, ${v.skipped} skipped.`;
                },
              )
            }
            className={btnOutline}
          >
            Resolve due votes
          </button>
        </div>
      </div>
      <Note>{note}</Note>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
        <Link href="/game/players?role=player">
          <Stat label="Players" value={counts.players} hint="active on the board" />
        </Link>
        <Link href="/game/players?role=watcher">
          <Stat label="Watchers" value={counts.watchers} hint={`${counts.demoted} demoted · ${counts.cheaters} flagged`} />
        </Link>
        <Link href="/game/review">
          <Stat
            label="To review"
            value={review.data?.total ?? "…"}
            hint={oldest(review.data?.items.map((i) => i.createdAt))}
          />
        </Link>
        <Link href="/game/reports">
          <Stat label="Open reports" value={reports.data ? openReports : "…"} hint={reports.data?.oldestOpenSeconds != null ? `oldest ${Math.round(reports.data.oldestOpenSeconds / 3600)} h` : "none waiting"} />
        </Link>
        <Link href="/game/tasks?status=approved">
          <Stat label="Tasks live" value={approved.data?.templates.length ?? "…"} hint={`${drafts.data?.templates.length ?? "…"} drafts to approve`} />
        </Link>
        <Link href="/game/board">
          <Stat
            label="On the board"
            value={board.data?.total ?? "…"}
            hint="ranked, never cut"
          />
        </Link>
      </div>

      <div className="grid gap-12 lg:grid-cols-2">
        <section>
          <SectionTitle
            aside={
              <Link href="/game/board" className={btnGhostSm}>
                Full board →
              </Link>
            }
          >
            Top of the board
          </SectionTitle>
          {board.data && board.data.rows.length === 0 && (
            <Empty>Nobody has scored yet.</Empty>
          )}
          <ol className="border-t border-subtle">
            {board.data?.rows.map((row) => (
              <li
                key={row.handle}
                className="flex items-baseline justify-between gap-4 border-b border-subtle py-3 text-sm"
              >
                <span className="flex items-baseline gap-3">
                  <span className="w-6 text-xs tabular-nums text-muted">
                    {row.rank}
                  </span>
                  <span className="font-bold uppercase tracking-wide">
                    {row.handle}
                  </span>
                  <span className="text-[10px] tracking-widest text-muted">
                    {hearts(row.heartsRemaining, row.heartsTotal)}
                  </span>
                </span>
                <span className="tabular-nums">{row.nerve} Nerve</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <SectionTitle
            aside={
              <Link href="/game/review" className={btnGhostSm}>
                Open the queue →
              </Link>
            }
          >
            Waiting for a verdict
          </SectionTitle>
          {review.error && <ErrorNote message={review.error} />}
          {review.data && review.data.items.length === 0 && (
            <Empty>The queue is clear.</Empty>
          )}
          <ul className="border-t border-subtle">
            {review.data?.items.slice(0, 6).map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-subtle py-3 text-sm"
              >
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="font-bold uppercase tracking-wide">
                    {item.enrolment.handle}
                  </span>
                  <span className="text-xs text-muted">
                    day {item.day} · {item.kind}
                  </span>
                  {item.aiVerdict && (
                    <Pill
                      tone={
                        item.aiVerdict.verdict === "cheating"
                          ? "warn"
                          : item.aiVerdict.verdict === "suspicious"
                            ? "outline"
                            : "neutral"
                      }
                    >
                      model: {item.aiVerdict.verdict}
                    </Pill>
                  )}
                </span>
                <span className="text-xs text-muted">
                  {formatDateTime(item.submittedAt ?? item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {rules.data && (
        <section>
          <SectionTitle>The rules the server is enforcing</SectionTitle>
          <p className="max-w-3xl text-xs leading-6 text-muted">
            {rules.data.minimumAge}+ only · {rules.data.dailyMinimumTasks} tasks
            a day minimum · {rules.data.startingHearts} hearts, lost by{" "}
            {rules.data.heartCosts.join(" or ")} · clans of{" "}
            {rules.data.clanSize} · team penalty{" "}
            {rules.data.teamPenaltyCoins.min}–{rules.data.teamPenaltyCoins.max}{" "}
            coins · votes open {rules.data.voting.windowHours} h, pay{" "}
            {rules.data.voting.rewardCoins.min}–{rules.data.voting.rewardCoins.max}{" "}
            coins, {rules.data.voting.cooldownHours} h cooldown · enrolment
            open every day · no elimination by rank · ties:{" "}
            {rules.data.tieBreak}.
          </p>
        </section>
      )}
    </div>
  );
}

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

function oldest(dates: string[] | undefined): string | undefined {
  if (!dates || dates.length === 0) return "nothing waiting";
  const first = dates.reduce((a, b) => (a < b ? a : b));
  const hoursAgo = Math.round((Date.now() - new Date(first).getTime()) / 3.6e6);
  return `oldest ${hoursAgo} h ago`;
}
