"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Field } from "@/components/form";
import { Icon } from "@/components/icon";
import { BackLink } from "@/components/nav";
import {
  Body,
  Button,
  Dialog,
  Display,
  ErrorNote,
  Hearts,
  Label,
  Loading,
  Rule,
  Screen,
} from "@/components/ui";
import { errorMessages, type ClanView } from "@/lib/api";
import {
  useCreateClan,
  useDashboard,
  useJoinClan,
  useLeaveClan,
  useMyClan,
  useRules,
} from "@/lib/queries";
import { formatNumber } from "@/lib/utils";

/**
 * `/clan` — two players, one leader, team tasks.
 *
 * A clan is exactly two people. That single fact drives the whole screen:
 * there is no roster management, no roles beyond leader/member, and the
 * invite code is the entire joining flow. Anything more would be UI for a
 * problem the game does not have.
 *
 * The code is only handed to the clan's own members, and only while
 * forming — once it is full the backend stops returning it, which is why
 * this never renders a stale one.
 */
export default function ClanPage() {
  const clan = useMyClan();
  const rules = useRules();
  const dashboard = useDashboard();

  // Clans are a player thing: the backend refuses a watcher's create or
  // join (`require(user, 'player')`), so offering them the forms only
  // promises something that will fail on submit.
  const isWatcher = dashboard.data?.enrolment?.role === "watcher";

  if (clan.isLoading || dashboard.isLoading) {
    return (
      <Screen width="sm">
        <Loading />
      </Screen>
    );
  }

  return (
    <main>
      <Screen width="sm" className="flex flex-col gap-9 py-4">
        <BackLink href="/play" />
        {clan.data ? (
          <ClanDetail clan={clan.data} />
        ) : isWatcher ? (
          <WatchersHaveNoClan />
        ) : (
          <NoClan size={rules.data?.clanSize ?? 2} />
        )}
      </Screen>
    </main>
  );
}

/* ------------------------------------------------------------ watcher */

function WatchersHaveNoClan() {
  return (
    <header className="flex flex-col gap-3">
      <Label>Players only</Label>
      <Display size="title">Clan</Display>
      <Body size="sm">
        Clans are for players — two of them, one task between them.
        Watchers can&apos;t start or join one.
      </Body>
    </header>
  );
}

/* ------------------------------------------------------------ no clan */

function NoClan({ size }: { size: number }) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const create = useCreateClan();
  const join = useJoinClan();

  const errors = errorMessages(create.error ?? join.error);
  const pending = create.isPending || join.isPending;

  return (
    <>
      <header className="flex flex-col gap-3">
        <Label>{size} players, one task between you</Label>
        <Display size="title">Clan</Display>
        <Body size="sm">
          Team tasks are drawn by the leader and pay both of you. A failed
          one costs you both.
        </Body>
      </header>

      <div className="flex gap-8">
        {(["create", "join"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={
              mode === value
                ? "font-pixel text-[11px] uppercase tracking-[0.12em] text-cyan [text-shadow:var(--glow-cyan)]"
                : "font-pixel text-[11px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-ink"
            }
          >
            {value === "create" ? "Start one" : "Join one"}
          </button>
        ))}
      </div>

      <Rule />

      <form
        className="flex flex-col gap-7"
        onSubmit={(event) => {
          event.preventDefault();
          if (mode === "create") create.mutate(name.trim());
          else join.mutate(code.trim().toUpperCase());
        }}
      >
        {mode === "create" ? (
          <Field
            label="Clan name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={3}
            maxLength={24}
            required
            placeholder="NAME IT"
            hint="Everyone sees this on the board."
          />
        ) : (
          <Field
            label="Invite code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            minLength={4}
            maxLength={12}
            required
            placeholder="FROM YOUR LEADER"
            autoCapitalize="characters"
            autoComplete="off"
          />
        )}

        {errors.map((message) => (
          <ErrorNote key={message}>{message}</ErrorNote>
        ))}

        <Button type="submit" size="lg" loading={pending}>
          {mode === "create" ? "Start the clan" : "Join"}
        </Button>
      </form>
    </>
  );
}

/* ---------------------------------------------------------- have a clan */

function ClanDetail({ clan }: { clan: ClanView }) {
  const leave = useLeaveClan();
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  const forming = clan.status === "forming";
  const isLeader = clan.myRole === "leader";

  return (
    <>
      <header className="flex flex-col gap-3">
        <Label tone={forming ? "caution" : "good"}>
          {clan.status === "forming"
            ? "Waiting for one more"
            : clan.status === "full"
              ? "Full · team tasks unlocked"
              : "Disbanded"}
        </Label>
        <Display size="title">{clan.name}</Display>
      </header>

      {/* the invite code — only while forming, only to members */}
      {forming && clan.inviteCode ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 py-2"
        >
          <Label>Send this to the other one</Label>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(clan.inviteCode ?? "");
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            }}
            className="group flex items-center gap-4 py-2 text-left"
          >
            <span className="font-pixel text-[26px] tracking-[0.2em] text-cyan text-glow-lg">
              {clan.inviteCode}
            </span>
            <Icon
              name={copied ? "star" : "send"}
              size="sm"
              className="opacity-50 transition-opacity group-hover:opacity-100"
            />
          </button>
          <Label tone={copied ? "good" : "faint"}>
            {copied ? "Copied" : "Tap to copy"}
          </Label>
        </motion.div>
      ) : null}

      <Rule />

      {/* members */}
      <section className="flex flex-col gap-5">
        <Label>
          {clan.size} of 2
        </Label>

        <ul className="flex flex-col gap-5">
          {clan.members.map((member) => (
            <li key={member.enrolmentId} className="flex items-center gap-4">
              <Icon
                name={member.role === "leader" ? "crown" : "profile"}
                size="sm"
                glow
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-pixel text-[12px] uppercase tracking-[0.08em] text-ink">
                  {member.handle}
                </span>
                <Label tone="faint">{member.role}</Label>
              </div>

              <Hearts remaining={member.heartsRemaining} total={3} size={12} />

              <span className="w-14 shrink-0 text-right font-pixel text-[11px] tabular-nums text-cyan">
                {formatNumber(member.nerve)}
              </span>
            </li>
          ))}

          {clan.size < 2 ? (
            <li className="flex items-center gap-4 opacity-40">
              <Icon name="users" size="sm" dim />
              <span className="font-pixel text-[12px] uppercase tracking-[0.08em] text-ink-faint">
                Empty seat
              </span>
            </li>
          ) : null}
        </ul>
      </section>

      {clan.status === "full" ? (
        <>
          <Rule />
          <Body size="sm">
            {isLeader
              ? "You draw the team task. Both of you are paid for it, and both of you pay for a failure."
              : "Your leader draws the team task. You are both paid for it."}
          </Body>
        </>
      ) : null}

      {/* leaving — only while forming, per the API */}
      {forming ? (
        <div className="pt-4">
          <Button variant="danger" marker={false} onClick={() => setConfirming(true)}>
            Leave
          </Button>
        </div>
      ) : null}

      <Dialog
        open={confirming}
        title="Leave the clan?"
        destructive
        confirmLabel="Leave"
        cancelLabel="Stay"
        busy={leave.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => leave.mutate(undefined, { onSettled: () => setConfirming(false) })}
      >
        {isLeader
          ? "You are the leader, so leaving disbands it for both of you."
          : "You can join another one afterwards."}
      </Dialog>
    </>
  );
}
