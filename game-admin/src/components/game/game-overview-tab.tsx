"use client";

import Link from "next/link";
import { gameApi } from "@/lib/api";
import type { GameEnrolment, SeasonStatus } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  Badge,
  btnPrimary,
  btnSecondary,
  Card,
  cardCls,
  Empty,
  ErrorNote,
  eyebrow,
  Loading,
  Note,
  Panel,
  Stat,
  type Tone,
} from "../ui";
import { formatDateTime, Hearts, n, timeAgo, useAction } from "./game-ui";

const SEASON_TONE: Record<SeasonStatus, Tone> = {
  draft: "neutral",
  open: "info",
  running: "solid",
  closed: "neutral",
};

const SEASON_NOTE: Record<SeasonStatus, string> = {
  draft: "Not visible to anyone yet.",
  open: "Enrolling. No clock is running.",
  running: "Live. Clocks are running and hand-ins are arriving.",
  closed: "Finished.",
};

/**
 * The season at a glance: where it is, who is in it, what is waiting, and the
 * two buttons an operator reaches for at midnight.
 *
 * Every number is a link to the screen that acts on it. A dashboard that only
 * reports is a dashboard you check and then navigate away from anyway.
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

  const { note, busy, act } = useAction(() => {
    enrolments.reload();
    review.reload();
    board.reload();
  });

  if (season.loading) return <Loading label="Loading the season" />;
  if (season.error) return <ErrorNote message={season.error} />;

  const live = season.data?.season ?? null;
  const people = enrolments.data?.enrolments ?? [];
  const counts = tally(people);
  const openReports =
    (reports.data?.byStatus.open ?? 0) + (reports.data?.byStatus.reviewing ?? 0);
  const queue = review.data?.items ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------ the season */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className={eyebrow}>Season</p>
            {live ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-[24px] leading-none">
                    {live.title}
                  </h2>
                  <Badge tone={SEASON_TONE[live.status]}>{live.status}</Badge>
                </div>
                <p className="mt-2.5 text-[12px] text-muted">
                  {SEASON_NOTE[live.status]}
                  {live.startsAt && live.status === "running" && (
                    <> Started {formatDateTime(live.startsAt)}.</>
                  )}
                  {rules.data && (
                    <> {rules.data.startingHearts} hearts to start.</>
                  )}
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-2 font-display text-[24px] leading-none">
                  No season
                </h2>
                <p className="mt-2.5 max-w-md text-[12px] leading-6 text-muted">
                  Nobody can enrol and the board is empty until one is open.{" "}
                  <Link href="/seasons" className="text-ink underline underline-offset-4">
                    Create or open one
                  </Link>
                  .
                </p>
              </>
            )}
          </div>

          {/* The two things done by hand, kept together and out of the way of
              everything that is only being read. */}
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !live}
                onClick={() =>
                  act(
                    () => gameApi.runSweeps(),
                    (r) => {
                      const s = r as Awaited<ReturnType<typeof gameApi.runSweeps>>;
                      const skipped = s.dailyMinimum.skipped
                        ? ` (daily minimum skipped: ${s.dailyMinimum.skipped.replace(/_/g, " ")})`
                        : "";
                      return `Sweeps ran. ${s.dailyMinimum.demoted.length} moved for the daily minimum, ${s.zeroBalance.demoted.length} on zero balance${skipped}.`;
                    },
                  )
                }
                className={btnSecondary}
              >
                Run sweeps
              </button>
              <button
                type="button"
                disabled={busy || !live}
                onClick={() =>
                  act(
                    () => gameApi.resolveVotes(),
                    (r) => {
                      const v = r as Awaited<
                        ReturnType<typeof gameApi.resolveVotes>
                      >;
                      return `Votes: ${v.resolved} resolved, ${v.deferred} deferred to a person, ${v.skipped} skipped.`;
                    },
                  )
                }
                className={btnPrimary}
              >
                Resolve votes
              </button>
            </div>
          </div>
        </div>
        <div className="mt-5 border-t border-line pt-3">
          <Note>
            {note ??
              "The crons run both of these nightly, in Tbilisi time. These are the same buttons, for a test season or an instance that slept through one."}
          </Note>
        </div>
      </Card>

      {/* -------------------------------------------------------- the count */}
      <div
        className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-3 sm:divide-x lg:grid-cols-6`}
      >
        <StatLink href="/players?role=player" label="Players" value={counts.players} hint="active on the board" />
        <StatLink
          href="/players?role=watcher"
          label="Watchers"
          value={counts.watchers}
          hint={`${counts.demoted} demoted · ${counts.cheaters} flagged`}
        />
        <StatLink
          href="/review"
          label="To review"
          value={review.data?.total ?? "—"}
          hint={oldest(queue.map((i) => i.createdAt))}
          tone={queue.length > 20 ? "caution" : undefined}
        />
        <StatLink
          href="/reports"
          label="Open reports"
          value={reports.data ? openReports : "—"}
          hint={
            reports.data?.oldestOpenSeconds != null
              ? `oldest ${Math.round(reports.data.oldestOpenSeconds / 3600)} h`
              : "none waiting"
          }
          tone={(reports.data?.openByPriority["3"] ?? 0) > 0 ? "danger" : undefined}
        />
        <StatLink
          href="/tasks?status=approved"
          label="Tasks live"
          value={approved.data?.templates.length ?? "—"}
          hint={`${drafts.data?.templates.length ?? "—"} drafts to approve`}
        />
        <StatLink
          href="/board"
          label="On the board"
          value={board.data?.total ?? "—"}
          hint="ranked, never cut"
        />
      </div>

      {/* --------------------------------------------------------- two lists */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Top of the board"
          aside={
            <Link href="/board" className="text-[12px] font-semibold text-muted hover:text-ink">
              Full board →
            </Link>
          }
          bleed
        >
          {board.data && board.data.rows.length === 0 ? (
            <Empty>Nobody has scored yet.</Empty>
          ) : (
            <ol>
              {board.data?.rows.map((row) => (
                <li
                  key={row.handle}
                  className="flex items-center gap-4 border-t border-line px-5 py-3 last:pb-4"
                >
                  <span className="tnum w-5 text-[12px] font-bold text-faint">
                    {row.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                    {row.handle}
                  </span>
                  <Hearts remaining={row.heartsRemaining} total={row.heartsTotal} />
                  <span className="tnum w-20 text-right text-[13px] font-bold">
                    {n(row.nerve)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel
          title="Waiting for a verdict"
          aside={
            <Link href="/review" className="text-[12px] font-semibold text-muted hover:text-ink">
              Open the queue →
            </Link>
          }
          bleed
        >
          {review.error && <div className="px-5"><ErrorNote message={review.error} /></div>}
          {review.data && queue.length === 0 ? (
            <Empty>The queue is clear.</Empty>
          ) : (
            <ul>
              {queue.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 border-t border-line px-5 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold">
                      {item.enrolment.handle}
                    </span>
                    <span className="block text-[11px] text-faint">
                      day {item.day} · {item.kind} ·{" "}
                      {timeAgo(item.submittedAt ?? item.createdAt)}
                    </span>
                  </span>
                  {item.aiVerdict && (
                    <Badge
                      tone={
                        item.aiVerdict.verdict === "cheating"
                          ? "danger"
                          : item.aiVerdict.verdict === "suspicious"
                            ? "caution"
                            : "neutral"
                      }
                    >
                      {item.aiVerdict.verdict}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ---------------------------------------------------------- the rules */}
      {rules.data && (
        <Panel title="The rules the server is enforcing">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            <Rule term="Minimum age" detail={`${rules.data.minimumAge} and over, both sides`} />
            <Rule term="Daily minimum" detail={`${rules.data.dailyMinimumTasks} hand-ins a day`} />
            <Rule term="Hearts" detail={`${rules.data.startingHearts}, lost by ${rules.data.heartCosts.join(" or ")}`} />
            <Rule term="Clans" detail={`${rules.data.clanSize} people · penalty ${rules.data.teamPenaltyCoins.min}–${rules.data.teamPenaltyCoins.max} coins`} />
            <Rule term="Voting" detail={`open ${rules.data.voting.windowHours} h · pays ${rules.data.voting.rewardCoins.min}–${rules.data.voting.rewardCoins.max} coins · ${rules.data.voting.cooldownHours} h cooldown`} />
            <Rule term="Enrolment" detail="open every day of the season" />
            <Rule term="Elimination by rank" detail={rules.data.eliminationByRank ? "yes" : "none — the board ranks, it does not cut"} />
            <Rule term="Ties" detail={rules.data.tieBreak} />
          </dl>
        </Panel>
      )}
    </div>
  );
}

/** A stat that goes somewhere. The whole cell is the target, not the number. */
function StatLink({
  href,
  label,
  value,
  hint,
  tone,
}: {
  href: string;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "danger" | "caution";
}) {
  return (
    <Link
      href={href as never}
      className="p-5 transition-colors hover:bg-raised"
    >
      <Stat label={label} value={value} hint={hint} tone={tone} />
    </Link>
  );
}

function Rule({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className={eyebrow}>{term}</dt>
      <dd className="mt-1 text-[12px] leading-5 text-ink">{detail}</dd>
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

function oldest(dates: string[]): string {
  if (dates.length === 0) return "nothing waiting";
  const first = dates.reduce((a, b) => (a < b ? a : b));
  return `oldest ${timeAgo(first)}`;
}
