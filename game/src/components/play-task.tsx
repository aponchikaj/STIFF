"use client";

/**
 * The task an opal deals — the player loop, laid out as one card.
 *
 *   nothing held → dealt the moment the opal is opened; DRAW after that
 *   offered      → the task, top to bottom: what it is, how it is proved,
 *                  what it pays — then ACCEPT (blue) or DECLINE (red)
 *   accepted     → the clock, the task, and HAND IN
 *   submitted    → handed in; draw the next one
 *
 * The card reads in the order a person decides: *what is it*, *can I prove
 * it*, *is it worth it*, and only then the two answers. The prize sits
 * between the brief and the buttons on purpose — it is the last thing read
 * before choosing.
 *
 * The money is stated exactly as the server settles it, not as a nicer
 * story: the reward is paid when the hand-in is approved; a decline or a
 * clock run out costs a heart; only a team task also costs opals.
 */

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Clock } from "@/components/clock";
import {
  HandInSheet,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  MIN_VIDEO_SECONDS,
} from "@/components/hand-in";
import { Icon } from "@/components/icon";
import {
  Body,
  Button,
  Dialog,
  Display,
  ErrorNote,
  Label,
  Loading,
  Rule,
} from "@/components/ui";
import type {
  ApiError,
  AssignmentView,
  PlayableTask,
  SeasonDay,
  TemplateCriterion,
} from "@/lib/api";
import {
  useAcceptAssignment,
  useCurrentAssignment,
  useDeclineAssignment,
  useDrawTask,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

const NAME: Record<SeasonDay, string> = { 1: "001", 2: "002", 3: "003" };
const EASE = [0.16, 1, 0.3, 1] as const;

export function TaskArea({
  day,
  heartsRemaining,
  today,
  autoDraw,
}: {
  /** The open opal: the tier a draw deals from. */
  day: SeasonDay;
  heartsRemaining: number;
  today: { handedIn: number; minimum: number } | null;
  /** Deal at once — the opal was just opened. Fires at most once. */
  autoDraw: boolean;
}) {
  const assignment = useCurrentAssignment();
  const draw = useDrawTask();
  const accept = useAcceptAssignment();
  const decline = useDeclineAssignment();

  const [handInOpen, setHandInOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  // The server's "current" is only an offer or a running clock, so a hand-in
  // vanishes from it the moment it lands. Kept here so the screen can say
  // "handed in" instead of falling straight back to an empty draw.
  const [handedIn, setHandedIn] = useState<AssignmentView | null>(null);

  const held = assignment.data ?? null;
  const current = held ?? handedIn;
  const holding =
    current && (current.status === "offered" || current.status === "accepted");

  // "Open the opal, get the task." One draw, guarded by a ref so a re-render
  // (or React's development double-mount) cannot deal twice; the server
  // would hand back the same offer anyway, but a second request is a second
  // spinner.
  const dealt = useRef(false);
  useEffect(() => {
    if (!autoDraw || dealt.current || assignment.isLoading || holding) return;
    dealt.current = true;
    draw.mutate(day);
  }, [autoDraw, assignment.isLoading, holding, day, draw]);

  const error = (draw.error ?? accept.error ?? decline.error) as ApiError | null;

  if (assignment.isLoading) return <Loading label="READING YOUR TASK" />;

  return (
    <section className="flex w-full flex-col gap-8">
      {error ? <ErrorNote>{error.message}</ErrorNote> : null}

      <AnimatePresence mode="wait">
        {draw.isPending && !holding ? (
          <Stage key="dealing">
            <Dealing day={day} />
          </Stage>
        ) : !current ||
          current.status === "declined" ||
          current.status === "expired" ? (
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
            <TaskOffer
              assignment={current}
              heartsRemaining={heartsRemaining}
              accepting={accept.isPending}
              onAccept={() => accept.mutate(current.id)}
              onDecline={() => setDeclineOpen(true)}
            />
          </Stage>
        ) : current.status === "accepted" ? (
          <Stage key="accepted">
            <RunningStage assignment={current} onHandIn={() => setHandInOpen(true)} />
          </Stage>
        ) : (
          <Stage key="submitted">
            <SubmittedStage
              assignment={current}
              day={day}
              drawing={draw.isPending}
              onDraw={() => {
                setHandedIn(null);
                draw.mutate(day);
              }}
            />
          </Stage>
        )}
      </AnimatePresence>

      {today ? (
        <>
          <Rule />
          <DailyProgress done={today.handedIn} needed={today.minimum} />
        </>
      ) : null}

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
        {heartsRemaining <= 1
          ? "This is your last heart. Declining ends your season as a player — you become a watcher."
          : `Costs one heart. You have ${heartsRemaining}, and the draw does not come back.`}
      </Dialog>

      {current && handInOpen ? (
        <HandInSheet
          assignment={current}
          onClose={() => setHandInOpen(false)}
          onDone={(done) => setHandedIn({ ...done, status: "submitted" })}
        />
      ) : null}
    </section>
  );
}

/* ================================================================ stages */

/** Shared entrance/exit, so every stage change reads as one movement. */
function Stage({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex flex-col gap-8"
    >
      {children}
    </motion.div>
  );
}

/** The beat between opening the opal and the task landing. */
function Dealing({ day }: { day: SeasonDay }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="font-pixel text-[11px] uppercase tracking-[0.14em] text-cyan text-glow-cyan">
        Opal {NAME[day]} is dealing
        <span className="animate-[blink_0.7s_steps(2,end)_infinite]"> ▮</span>
      </span>
    </div>
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
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div className="flex flex-col gap-3">
        <Display size="sm">
          {lastStatus === "expired"
            ? "The clock ran out"
            : lastStatus === "declined"
              ? "You said no"
              : "Nothing in hand"}
        </Display>
        <Body size="sm" className="mx-auto max-w-sm">
          The opal picks the task. You accept it or you lose a heart.
        </Body>
      </div>
      <Button size="lg" loading={pending} onClick={onDraw}>
        Draw from {NAME[day]}
      </Button>
    </div>
  );
}

/**
 * An offered task: the whole card, ending in the two answers.
 *
 * Exported because it is purely presentational — `/play?demo=…` renders it
 * with a sample task, so the design can be looked at without a live draw.
 */
export function TaskOffer({
  assignment,
  heartsRemaining,
  accepting,
  onAccept,
  onDecline,
}: {
  assignment: AssignmentView;
  heartsRemaining: number;
  accepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <article className="flex flex-col gap-9">
      <TaskHeader assignment={assignment} />
      <TaskBody task={assignment.task} />
      <Prize task={assignment.task} />
      <Answers
        clockMinutes={assignment.clockMinutes}
        heartsRemaining={heartsRemaining}
        accepting={accepting}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    </article>
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
    <article className="flex flex-col gap-9">
      <Clock expiresAt={assignment.expiresAt} size="lg" />
      <TaskHeader assignment={assignment} />
      <TaskBody task={assignment.task} />
      <Prize task={assignment.task} running />
      <div className="flex justify-center">
        <Button
          size="lg"
          icon={assignment.task.proof === "photo" ? "camera" : "video"}
          onClick={onHandIn}
        >
          Hand it in
        </Button>
      </div>
    </article>
  );
}

function SubmittedStage({
  assignment,
  day,
  drawing,
  onDraw,
}: {
  assignment: AssignmentView;
  day: SeasonDay;
  drawing: boolean;
  onDraw: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <Icon name="just-trophy" size="xl" glow="lg" />
      <Display size="sm">Handed in</Display>
      <Body size="sm" className="max-w-sm">
        It goes to the watchers. If they pass it you are paid +
        {assignment.task.rewardNerve} nerve and +{assignment.task.rewardCoins}{" "}
        {plural(assignment.task.rewardCoins, "opal")}. The opal still deals
        while it is open — draw the next one when you are ready.
      </Body>
      <Button size="lg" loading={drawing} onClick={onDraw}>
        Draw next from {NAME[day]}
      </Button>
      <div className="flex gap-8">
        <Link href="/feed">
          <Button variant="quiet" size="sm">
            See the feed
          </Button>
        </Link>
        <Link href="/board">
          <Button variant="quiet" size="sm">
            Check the board
          </Button>
        </Link>
      </div>
      <Label tone="faint">
        Opal {NAME[assignment.day]} · {assignment.task.title}
      </Label>
    </div>
  );
}

/* ============================================================ the card */

/** Where it came from, what kind it is, and its name. */
function TaskHeader({ assignment }: { assignment: AssignmentView }) {
  const { task } = assignment;
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Label>Opal {NAME[assignment.day]}</Label>
        <Dot />
        <Label tone="muted">{task.mode === "team" ? "Team task" : "Solo task"}</Label>
        <Dot />
        <Label tone="muted">{assignment.clockMinutes} min clock</Label>
      </div>
      <Display size="title">{task.title}</Display>
    </header>
  );
}

/** The brief, then how it is proved and judged, then what voids it. */
function TaskBody({ task }: { task: PlayableTask }) {
  const criteria = task.criteria
    .map((c) => ({ ...c, text: criterionText(c) }))
    .filter((c): c is TemplateCriterion & { text: string } => c.text !== null);

  return (
    <div className="flex flex-col gap-8">
      <p className="font-body text-[18px] leading-[26px] text-ink">{task.brief}</p>

      <Section title="Prove it with" icon={task.proof === "photo" ? "camera" : "video"}>
        <Body size="sm">{proofText(task)}</Body>
      </Section>

      {criteria.length > 0 ? (
        <Section title="The watchers check" icon="eye">
          <ul className="flex flex-col gap-2.5">
            {criteria.map((c, i) => (
              <li key={c.id ?? i} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-[3px] font-pixel text-[9px] text-cyan text-glow-cyan-xs"
                >
                  ▶
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-body text-body-sm leading-[18px] text-ink-muted">
                    {c.text}
                  </span>
                  <span className="font-body text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                    {c.modality === "audio" ? "Heard" : "Seen"}
                    {c.required === false ? " · optional" : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* The guards are the rules that get a hand-in rejected. Burying them
          behind a disclosure is how a player loses a heart to a rule they
          were never shown. */}
      {task.guards.length > 0 ? (
        <Section title="Do not" icon="warning" tone="heart">
          <ul className="flex flex-col gap-2">
            {task.guards.map((guard) => (
              <li
                key={guard}
                className="flex items-start gap-3 font-body text-body-sm leading-[18px] text-ink-muted"
              >
                <span aria-hidden className="text-heart text-glow-heart-xs">
                  ×
                </span>
                {guard}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

/**
 * The prize — what finishing pays — and the price of walking away.
 *
 * A scanline band rather than a box: the one region on the card that has to
 * read as its own thing, lit from inside.
 */
function Prize({ task, running = false }: { task: PlayableTask; running?: boolean }) {
  const team = task.mode === "team";
  return (
    <section
      aria-label="Prize"
      className="relative -mx-4 overflow-hidden px-4 py-7 sm:-mx-6 sm:px-6"
    >
      {/* the band: a faint blue field with scanlines, hairlines top and bottom */}
      <div
        aria-hidden
        className="scanlines pointer-events-none absolute inset-0 border-y border-blue-dim/70"
        style={{
          background:
            "radial-gradient(ellipse 80% 120% at 50% 0%, rgb(1 163 255 / 0.13), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Label>{running ? "On the line" : "The prize"}</Label>
          <Label tone="faint">{team ? "Each of you" : "Yours"}</Label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <PrizeLine
            icon="star"
            amount={task.rewardNerve}
            unit="Nerve"
            note="Your score on the board"
            tone="cyan"
            delay={0.1}
          />
          <PrizeLine
            icon="opal"
            amount={task.rewardCoins}
            unit={plural(task.rewardCoins, "Opal")}
            note="Spend them in the shop"
            tone="coin"
            delay={0.2}
          />
        </div>

        <p className="font-body text-caption leading-4 uppercase tracking-[0.1em] text-ink-faint">
          Paid when the watchers pass your hand-in.
        </p>

        <div className="flex flex-col gap-2 border-t border-blue-dim/40 pt-4">
          <Label tone="heart">If you walk away</Label>
          <p className="font-body text-body-sm leading-[18px] text-ink-muted">
            Decline it, or let the clock run out:{" "}
            <span className="text-heart text-glow-heart-xs">−1 heart</span>
            {team ? (
              <>
                {" "}
                and{" "}
                <span className="text-heart text-glow-heart-xs">
                  −{task.penaltyCoins} {plural(task.penaltyCoins, "opal")}
                </span>{" "}
                each
              </>
            ) : null}
            .
          </p>
        </div>
      </div>
    </section>
  );
}

function PrizeLine({
  icon,
  amount,
  unit,
  note,
  tone,
  delay,
}: {
  icon: "star" | "opal";
  amount: number;
  unit: string;
  note: string;
  tone: "cyan" | "coin";
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE }}
      className="flex items-center gap-3"
    >
      <Icon
        name={icon}
        size="lg"
        glow={tone === "coin" ? "coin" : true}
        className="shrink-0"
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <span
          className={cn(
            "font-pixel text-[clamp(20px,6vw,30px)] leading-none tabular-nums",
            tone === "cyan" ? "text-cyan text-glow-cyan" : "text-coin text-glow-coin",
          )}
        >
          +{amount}
        </span>
        <span className="font-pixel text-[9px] uppercase tracking-[0.14em] text-ink">
          {unit}
        </span>
        <span className="hidden font-body text-[11px] leading-[14px] text-ink-faint sm:block">
          {note}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * ACCEPT and DECLINE, built like the home screen's WATCHER │ PLAYER: two
 * words, a hairline between, blue for the one that moves you forward and
 * the heart's red for the one that costs a heart. Each says what it does
 * underneath, so neither is pressed blind.
 */
function Answers({
  clockMinutes,
  heartsRemaining,
  accepting,
  onAccept,
  onDecline,
}: {
  clockMinutes: number;
  heartsRemaining: number;
  accepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="flex items-stretch justify-between gap-3 pt-1">
      <Answer
        tone="accept"
        label="Accept"
        note={`${clockMinutes} min clock starts`}
        busy={accepting}
        onClick={onAccept}
      />
      <span aria-hidden className="w-px self-center bg-blue-dim" style={{ height: 48 }} />
      <Answer
        tone="decline"
        label="Decline"
        note={
          heartsRemaining <= 1
            ? "Your last heart"
            : `Costs 1 of ${heartsRemaining} hearts`
        }
        disabled={accepting}
        onClick={onDecline}
      />
    </div>
  );
}

function Answer({
  tone,
  label,
  note,
  busy = false,
  disabled = false,
  onClick,
}: {
  tone: "accept" | "decline";
  label: string;
  note: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const accept = tone === "accept";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.08 }}
      className={cn(
        "group relative flex min-h-20 flex-1 flex-col items-center justify-center gap-2 px-2 transition-all duration-200 disabled:opacity-40",
      )}
    >
      <span
        className={cn(
          "relative inline-flex items-center font-pixel text-[clamp(16px,5vw,24px)] uppercase tracking-[0.14em] transition-all duration-200",
          accept
            ? "text-blue [text-shadow:var(--glow-blue)] group-hover:text-cyan group-hover:[text-shadow:var(--glow-cyan-lg)]"
            : "text-heart [text-shadow:var(--glow-heart)] group-hover:text-danger group-hover:[text-shadow:0_0_6px_rgb(255_59_48/1),0_0_22px_rgb(255_59_48/0.7)]",
        )}
      >
        <span
          aria-hidden
          // Out of flow, so the arrow cannot push the word off a phone screen.
          className={cn(
            "absolute -left-4 -translate-x-1 text-[0.6em] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
            accept ? "text-cyan" : "text-heart",
          )}
        >
          ▶
        </span>
        {busy ? (
          <span className="animate-[blink_0.7s_steps(2,end)_infinite]">▮▮▮</span>
        ) : (
          label
        )}
      </span>
      <span className="whitespace-nowrap font-body text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        {note}
      </span>
    </motion.button>
  );
}

/* ============================================================== fragments */

function Section({
  title,
  icon,
  tone = "blue",
  children,
}: {
  title: string;
  icon: "camera" | "video" | "eye" | "warning";
  tone?: "blue" | "heart";
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <Icon name={icon} size="xs" glow={tone === "heart" ? "heart" : true} />
        <Label tone={tone}>{title}</Label>
      </div>
      {children}
    </section>
  );
}

function Dot() {
  return <span aria-hidden className="size-1 bg-blue-dim" />;
}

/** Today's count against the nightly minimum, as a row of pips. */
function DailyProgress({ done, needed }: { done: number; needed: number }) {
  const met = done >= needed;
  return (
    <div className="flex items-center justify-between gap-5">
      <Label tone={met ? "good" : "faint"}>
        {met ? "Today's minimum met" : `${done} of ${needed} handed in today`}
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

/* --------------------------------------------------------------- helpers */

/** What a hand-in must be, in the same limits the hand-in sheet enforces. */
function proofText(task: PlayableTask): string {
  const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));
  const photo = `One photo — JPEG, PNG or WebP, up to ${mb(MAX_PHOTO_BYTES)} MB.`;
  const video = `One clip, ${MIN_VIDEO_SECONDS} seconds to ${MAX_VIDEO_SECONDS / 60} minutes — MP4, WebM or MOV, up to ${mb(MAX_VIDEO_BYTES)} MB.`;
  const proof =
    task.proof === "photo"
      ? photo
      : task.proof === "video"
        ? video
        : `Your choice: a photo or a clip. ${photo.replace("One photo — ", "Photos: ")} ${video.replace("One clip, ", "Clips: ")}`;
  const team =
    task.mode === "team" ? " Both of you have to be in it." : "";
  return `${proof}${team}`;
}

function criterionText(c: TemplateCriterion): string | null {
  const text = typeof c.assert === "string" ? c.assert : c.label;
  return text && text.trim() ? text.trim() : null;
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
