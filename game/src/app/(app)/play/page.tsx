"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Clock } from "@/components/clock";
import { Haze } from "@/components/crt";
import { HandInSheet } from "@/components/hand-in";
import { Icon } from "@/components/icon";
import {
  Body,
  Button,
  Dialog,
  Display,
  Empty,
  ErrorNote,
  Label,
  Loading,
  Rule,
  Screen,
  Stat,
} from "@/components/ui";
import type { ApiError, AssignmentView, SeasonDay } from "@/lib/api";
import {
  useAcceptAssignment,
  useCurrentAssignment,
  useDashboard,
  useDeclineAssignment,
  useDrawTask,
} from "@/lib/queries";
import { formatNumber } from "@/lib/utils";

/**
 * `/play` — the whole player loop on one screen.
 *
 * A season is three days and a day is one decision, so this screen is a
 * state machine with five states and shows exactly one of them. Tabs or
 * accordions here would be a way of hiding the only thing that matters.
 *
 *   no season     → nothing to do, say so
 *   watcher       → wrong screen, point at the one that pays them
 *   nothing drawn → DRAW
 *   offered       → the task, ACCEPT or DECLINE
 *   accepted      → the clock, and HAND IN
 *   submitted     → done for the day
 *
 * The transitions are animated because this is the one place in the game
 * where the screen changing *is* the event — accepting a task should feel
 * like a lever being pulled.
 */
export default function PlayPage() {
  const dashboard = useDashboard();
  const assignment = useCurrentAssignment();

  const [handInOpen, setHandInOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);

  const draw = useDrawTask();
  const accept = useAcceptAssignment();
  const decline = useDeclineAssignment();

  if (dashboard.isLoading) {
    return (
      <Screen width="md">
        <Loading label="READING THE BOARD" />
      </Screen>
    );
  }

  const data = dashboard.data;
  const enrolment = data?.enrolment ?? null;
  const season = data?.season ?? null;
  const current = assignment.data ?? null;

  /* ---------------------------------------------------- not a player yet */

  if (!enrolment) {
    return (
      <Screen width="sm" className="flex min-h-[70dvh] flex-col justify-center">
        <Empty icon="game" title="You have not picked a side">
          Player or watcher. You can only be one this season.
        </Empty>
        <div className="flex justify-center">
          <Link href="/join">
            <Button size="lg">Pick a side</Button>
          </Link>
        </div>
      </Screen>
    );
  }

  if (enrolment.role === "watcher") {
    return <WatcherScreen reason={enrolment.demotionReason} />;
  }

  if (!season || season.status !== "running") {
    return (
      <Screen width="sm" className="flex min-h-[70dvh] flex-col justify-center">
        <Empty icon="fuckingaround" title="No season running">
          {season
            ? `${season.title} is ${season.status}. Nothing to draw until it starts.`
            : "Nothing to draw yet. The feed is still worth watching."}
        </Empty>
      </Screen>
    );
  }

  /* ------------------------------------------------------------- the day */

  const today = data?.today ?? null;
  const day = pickDay(current);
  const error = (draw.error ?? accept.error ?? decline.error) as ApiError | null;

  return (
    <main className="relative overflow-hidden">
      <Haze intensity="sm" />

      <Screen width="md" className="flex flex-col gap-10 py-8">
        {/* standing */}
        <section className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-2">
            <Label>{season.title}</Label>
            <Display size="hero">Day {day}</Display>
          </div>

          <div className="flex items-center gap-7">
            <Stat
              icon="star"
              value={formatNumber(enrolment.nerve)}
              label="Nerve"
              tone="cyan"
            />
            {data?.rank ? (
              <Stat icon="trophy" value={`#${data.rank}`} label="Rank" />
            ) : null}
          </div>
        </section>

        {/* the daily minimum — shown early, because finding out at midnight
            that you were two short is the worst possible time to find out */}
        {today ? <DailyProgress done={today.handedIn} needed={today.minimum} /> : null}

        <Rule />

        {error ? <ErrorNote>{error.message}</ErrorNote> : null}

        {/* the one thing to do */}
        <AnimatePresence mode="wait">
          {!current || current.status === "declined" || current.status === "expired" ? (
            <Stage key="draw">
              <DrawStage
                day={day}
                pending={draw.isPending}
                lastStatus={current?.status}
                onDraw={() => draw.mutate(day)}
              />
            </Stage>
          ) : current.status === "offered" ? (
            <Stage key="offered">
              <OfferStage
                assignment={current}
                accepting={accept.isPending}
                onAccept={() => accept.mutate(current.id)}
                onDecline={() => setDeclineOpen(true)}
              />
            </Stage>
          ) : current.status === "accepted" ? (
            <Stage key="accepted">
              <RunningStage
                assignment={current}
                onHandIn={() => setHandInOpen(true)}
              />
            </Stage>
          ) : (
            <Stage key="submitted">
              <SubmittedStage assignment={current} />
            </Stage>
          )}
        </AnimatePresence>
      </Screen>

      <Dialog
        open={declineOpen}
        title="Decline this task?"
        destructive
        confirmLabel="Decline"
        cancelLabel="Keep it"
        busy={decline.isPending}
        onCancel={() => setDeclineOpen(false)}
        onConfirm={() => {
          if (!current) return;
          decline.mutate(current.id, { onSettled: () => setDeclineOpen(false) });
        }}
      >
        {enrolment.heartsRemaining <= 1
          ? "This is your last heart. Declining ends your season as a player — you become a watcher."
          : `Costs one heart. You have ${enrolment.heartsRemaining}, and the draw does not come back.`}
      </Dialog>

      {current && handInOpen ? (
        <HandInSheet assignment={current} onClose={() => setHandInOpen(false)} />
      ) : null}
    </main>
  );
}

/* ================================================================ stages */

/** Shared entrance/exit, so every stage change reads as one movement. */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-8"
    >
      {children}
    </motion.section>
  );
}

function DrawStage({
  day,
  pending,
  lastStatus,
  onDraw,
}: {
  day: SeasonDay;
  pending: boolean;
  lastStatus?: AssignmentView["status"];
  onDraw: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-8 py-10 text-center">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon name="target" size="2xl" glow="lg" />
      </motion.div>

      <div className="flex flex-col gap-3">
        <Display size="hero">
          {lastStatus === "expired"
            ? "The clock ran out"
            : lastStatus === "declined"
              ? "You said no"
              : "Nothing drawn"}
        </Display>
        <Body size="sm" className="mx-auto max-w-sm">
          {lastStatus
            ? "Draw again when you are ready. The server picks; you decide."
            : "The server picks the task. You accept it or you lose a heart."}
        </Body>
      </div>

      <Button size="lg" loading={pending} onClick={onDraw}>
        Draw day {day}
      </Button>
    </div>
  );
}

function OfferStage({
  assignment,
  accepting,
  onAccept,
  onDecline,
}: {
  assignment: AssignmentView;
  accepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <>
      <TaskBrief assignment={assignment} />

      <Rule tone="blue" />

      <div className="flex flex-wrap items-center justify-between gap-6">
        <Button variant="danger" marker={false} onClick={onDecline}>
          Decline · −1 heart
        </Button>
        <Button size="lg" loading={accepting} onClick={onAccept}>
          Accept · start clock
        </Button>
      </div>
    </>
  );
}

function RunningStage({
  assignment,
  onHandIn,
}: {
  assignment: AssignmentView;
  onHandIn: () => void;
}) {
  return (
    <>
      <Clock expiresAt={assignment.expiresAt} size="lg" />
      <TaskBrief assignment={assignment} compact />
      <Rule tone="blue" />
      <div className="flex justify-center">
        <Button
          size="lg"
          icon={assignment.task.proof === "photo" ? "camera" : "video"}
          onClick={onHandIn}
        >
          Hand it in
        </Button>
      </div>
    </>
  );
}

function SubmittedStage({ assignment }: { assignment: AssignmentView }) {
  return (
    <div className="flex flex-col items-center gap-7 py-10 text-center">
      <Icon name="just-trophy" size="2xl" glow="lg" />
      <Display size="hero">Handed in</Display>
      <Body size="sm" className="max-w-sm">
        It goes to the watchers. You will know when it is judged — nothing to
        do until then.
      </Body>
      <div className="flex gap-8">
        <Link href="/feed">
          <Button variant="quiet">See the feed</Button>
        </Link>
        <Link href="/board">
          <Button variant="quiet">Check the board</Button>
        </Link>
      </div>
      <Label tone="faint">Day {assignment.day} · {assignment.task.title}</Label>
    </div>
  );
}

/* ============================================================== fragments */

/** The task itself: what it is, what it pays, what it costs. */
function TaskBrief({
  assignment,
  compact = false,
}: {
  assignment: AssignmentView;
  compact?: boolean;
}) {
  const { task } = assignment;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Label>Tier {task.tier}</Label>
        <Label tone="faint">{task.mode === "team" ? "Team" : "Solo"}</Label>
        <Label tone="faint">
          {task.proof === "either" ? "Photo or video" : task.proof}
        </Label>
        <Label tone="faint">{task.clockMinutes} min</Label>
      </div>

      <Display size={compact ? "sm" : "hero"}>{task.title}</Display>

      {!compact ? <Body>{task.brief}</Body> : null}

      <div className="flex flex-wrap items-center gap-8">
        <Stat
          icon="star"
          value={`+${task.rewardNerve}`}
          label="Nerve"
          tone="cyan"
          size="sm"
        />
        <Stat
          icon="opal"
          value={`+${task.rewardCoins}`}
          label="Coins"
          tone="coin"
          size="sm"
        />
        {task.penaltyCoins > 0 ? (
          <Stat
            value={`−${task.penaltyCoins}`}
            label="If you fail"
            tone="heart"
            size="sm"
          />
        ) : null}
      </div>

      {/* The guards are the rules that get a hand-in rejected. Burying them
          behind a disclosure is how a player loses a heart to a rule they
          were never shown. */}
      {!compact && task.guards.length > 0 ? (
        <div className="flex flex-col gap-2.5 pt-2">
          <Label tone="heart">Do not</Label>
          <ul className="flex flex-col gap-1.5">
            {task.guards.map((guard) => (
              <li
                key={guard}
                className="flex items-start gap-2.5 font-body text-body-sm leading-[18px] text-ink-muted"
              >
                <span aria-hidden className="mt-0.5 text-heart">
                  ×
                </span>
                {guard}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Today's count against the nightly minimum, as a row of pips. */
function DailyProgress({ done, needed }: { done: number; needed: number }) {
  const met = done >= needed;

  return (
    <div className="flex items-center justify-between gap-5">
      <Label tone={met ? "good" : "faint"}>
        {met ? "Minimum met" : `${done} of ${needed} today`}
      </Label>

      <div
        className="flex items-center gap-1.5"
        role="img"
        aria-label={`${done} of ${needed} tasks handed in today`}
      >
        {Array.from({ length: needed }, (_, index) => (
          <span
            key={index}
            className={
              index < done
                ? "size-2 bg-good shadow-[0_0_8px_rgb(47_217_107/0.9)]"
                : "size-2 bg-blue-dim/50"
            }
          />
        ))}
      </div>
    </div>
  );
}

/** A watcher landed on the player screen. Send them somewhere useful. */
function WatcherScreen({ reason }: { reason: string | null }) {
  const explanation: Record<string, string> = {
    cheating: "You were marked a cheater. That is final for this season.",
    missed_daily_minimum: "You missed the daily minimum, so the season moved you to the audience.",
    zero_balance: "Your balance hit zero.",
    out_of_hearts: "You ran out of hearts.",
  };

  return (
    <Screen width="sm" className="flex min-h-[70dvh] flex-col justify-center gap-8">
      <Empty icon="eye" title={reason ? "You are a watcher now" : "You are watching"}>
        {reason
          ? `${explanation[reason] ?? "Your season as a player is over."} You still earn coins by voting.`
          : "Vote on what gets handed in. Every vote pays, and the shop takes coins."}
      </Empty>

      <div className="flex justify-center gap-8">
        <Link href="/vote">
          <Button size="lg">Vote</Button>
        </Link>
        <Link href="/feed">
          <Button variant="quiet" size="lg">
            Feed
          </Button>
        </Link>
      </div>
    </Screen>
  );
}

/* --------------------------------------------------------------- helpers */

/** The day in play. Falls back to 1 so the draw button always says something. */
function pickDay(current: AssignmentView | null): SeasonDay {
  return current?.day ?? 1;
}
