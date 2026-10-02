"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Icon } from "@/components/icon";
import {
  Body,
  Button,
  Display,
  Empty,
  Label,
  Loading,
  Rule,
  Screen,
} from "@/components/ui";
import type { VotableItem } from "@/lib/api";
import { useDashboard, useOpenVotes, useRules, useVote } from "@/lib/queries";
import { cn, formatClock } from "@/lib/utils";

/**
 * `/vote` — how a watcher earns.
 *
 * Watchers only, enforced server-side: a player's opinion of another
 * player's hand-in is not evidence, and the coins are the audience's. A
 * player landing here is told why rather than shown an empty list.
 *
 * The design decision that matters: **the tallies are hidden until you
 * have voted.** The API returns them regardless, but showing a running
 * 14–2 before someone decides turns every vote after the first into a
 * popularity echo. Once your vote is in, the split is the interesting part
 * and it appears.
 */
export default function VotePage() {
  const dashboard = useDashboard();
  const votes = useOpenVotes();
  const rules = useRules();

  const enrolment = dashboard.data?.enrolment;

  if (dashboard.isLoading) {
    return (
      <Screen width="md">
        <Loading />
      </Screen>
    );
  }

  if (enrolment && enrolment.role === "player") {
    return (
      <Screen width="sm" className="flex min-h-[70dvh] flex-col justify-center gap-8">
        <Empty icon="eye" title="Players do not vote">
          Your opinion of someone else&rsquo;s hand-in is not evidence. The
          audience judges; you hand in.
        </Empty>
        <div className="flex justify-center">
          <Link href="/play">
            <Button size="lg">Back to your task</Button>
          </Link>
        </div>
      </Screen>
    );
  }

  const reward = rules.data?.voting.rewardCoins;

  return (
    <main>
      <Screen width="md" className="flex flex-col gap-9 py-8">
        <header className="flex flex-col gap-3">
          <Label>
            {reward
              ? `${reward.min}–${reward.max} coins a vote · ${rules.data?.voting.cooldownHours}h cooldown`
              : "Judge what came in"}
          </Label>
          <Display size="title">Vote</Display>
          <Body size="sm" className="max-w-md">
            Did they actually do it? That is the whole question. The window
            closes {rules.data?.voting.windowHours ?? 3} hours after a
            hand-in lands.
          </Body>
        </header>

        <Rule />

        {votes.isLoading ? (
          <Loading label="FINDING OPEN VOTES" />
        ) : (votes.data?.length ?? 0) === 0 ? (
          <Empty icon="eye" title="Nothing open right now">
            Windows open as hand-ins come in. Check back when the clocks run
            down.
          </Empty>
        ) : (
          <ul className="flex flex-col gap-14">
            {votes.data?.map((item) => (
              <VoteCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </Screen>
    </main>
  );
}

function VoteCard({ item }: { item: VotableItem }) {
  const vote = useVote();
  const voted = item.myVote !== null;
  const total = item.yes + item.no;
  const yesShare = total > 0 ? item.yes / total : 0.5;

  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-5"
    >
      {/* the task they were given — you cannot judge a hand-in without it */}
      {item.task ? (
        <div className="flex flex-col gap-2.5">
          <Label>The task</Label>
          <Display size="sm">{item.task.title}</Display>
          <Body size="sm">{item.task.brief}</Body>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon name="profile" size="xs" glow className="shrink-0" />
          <span className="min-w-0 truncate font-pixel text-[11px] uppercase tracking-[0.1em] text-ink">
            {item.player.handle}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 font-pixel text-[11px] tabular-nums",
            item.secondsLeft <= 300 ? "text-caution" : "text-cyan",
          )}
        >
          {formatClock(item.secondsLeft)} left
        </span>
      </div>

      {/* the proof */}
      <div className="scanlines relative overflow-hidden bg-surface">
        {item.mediaUrl ? (
          item.kind === "video" ? (
            <video
              src={item.mediaUrl}
              controls
              playsInline
              preload="metadata"
              className="max-h-[60dvh] w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.mediaUrl}
              alt={item.caption ?? `Hand-in by ${item.player.handle}`}
              loading="lazy"
              className="max-h-[60dvh] w-full object-contain"
            />
          )
        ) : (
          <div className="flex h-48 items-center justify-center">
            <Icon name="warning" size="lg" className="opacity-30" />
          </div>
        )}
      </div>

      {item.caption ? <Body size="sm">{item.caption}</Body> : null}

      {/* the call */}
      {voted ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label tone={item.myVote === "yes" ? "good" : "heart"}>
              You said {item.myVote}
            </Label>
            <Label tone="faint">
              {item.yes} yes · {item.no} no
            </Label>
          </div>

          {/* The split, only now that it cannot bias the vote. */}
          <div className="flex h-0.5 w-full overflow-hidden bg-blue-dim/40">
            <motion.div
              className="bg-good shadow-[0_0_8px_rgb(47_217_107/0.8)]"
              initial={{ width: 0 }}
              animate={{ width: `${yesShare * 100}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
            <div className="flex-1 bg-heart/70" />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-12 py-2">
          <Button
            variant="good"
            size="lg"
            marker
            loading={vote.isPending && vote.variables?.value === "yes"}
            onClick={() => vote.mutate({ attemptId: item.id, value: "yes" })}
          >
            They did it
          </Button>
          <Button
            variant="danger"
            size="lg"
            marker={false}
            loading={vote.isPending && vote.variables?.value === "no"}
            onClick={() => vote.mutate({ attemptId: item.id, value: "no" })}
          >
            They did not
          </Button>
        </div>
      )}
    </motion.li>
  );
}
