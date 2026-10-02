"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import {
  Body,
  Button,
  Dialog,
  Display,
  Empty,
  Hearts,
  Label,
  Loading,
  Rule,
  Screen,
  Stat,
} from "@/components/ui";
import type { AttemptView, DemotionReason } from "@/lib/api";
import {
  useAuthState,
  useDashboard,
  useLogout,
  useMyAttempts,
  useMyReports,
  useStanding,
} from "@/lib/queries";
import { cn, formatAgo, formatNumber } from "@/lib/utils";

/**
 * `/me` — the account, the season, and the way out.
 *
 * Two identities are shown and they are genuinely different things: the
 * **account** is the shop's and is permanent, the **enrolment** is this
 * season's and can be demoted or marked a cheater. Collapsing them into
 * one "profile" is how someone ends up thinking a cheating verdict deleted
 * their shop account.
 */

const DEMOTION_COPY: Record<DemotionReason, string> = {
  cheating: "Marked a cheater. Final for this season.",
  missed_daily_minimum: "Missed the daily minimum.",
  zero_balance: "Balance hit zero.",
  out_of_hearts: "Ran out of hearts.",
};

export default function MePage() {
  const router = useRouter();
  const { isSignedIn, isResolved } = useAuthState();
  const dashboard = useDashboard();
  const standing = useStanding();
  const attempts = useMyAttempts();
  const reports = useMyReports();
  const logout = useLogout();

  const [confirmingOut, setConfirmingOut] = useState(false);

  if (!isResolved || dashboard.isLoading) {
    return (
      <Screen width="md">
        <Loading />
      </Screen>
    );
  }

  if (!isSignedIn) {
    return (
      <Screen width="sm" className="flex min-h-[70dvh] flex-col justify-center gap-8">
        <Empty icon="profile" title="Not signed in">
          Your coins, your hearts and your place on the board live on an
          account.
        </Empty>
        <div className="flex justify-center gap-8">
          <Link href="/login">
            <Button size="lg">Sign in</Button>
          </Link>
          <Link href="/join">
            <Button variant="quiet" size="lg">
              Join
            </Button>
          </Link>
        </div>
      </Screen>
    );
  }

  const data = dashboard.data;
  const user = data?.user;
  const enrolment = data?.enrolment ?? null;
  const name = enrolment?.handle ?? user?.username ?? "You";

  return (
    <main>
      <Screen width="md" className="flex flex-col gap-10 py-8">
        {/* who */}
        <header
          className="flex flex-col gap-3 [container-type:inline-size]"
          style={{ "--handle-chars": name.length + 1 } as CSSProperties}
        >
          <Label>{enrolment ? enrolment.role : "No side this season"}</Label>
          {/* A handle is up to 24 characters with no spaces, so the browser has
              nowhere to wrap it, and at 48px in a monospaced pixel face it is
              over 1100px wide. The size is the smaller of the title size and
              "one line exactly fills the column" — the face is 1em per glyph,
              so the column divided by the glyph count is that size. Below
              20px it stops shrinking and wraps instead, after an underscore
              where there is one, anywhere where there is not. */}
          <Display
            size="title"
            className="block max-w-full text-[length:min(clamp(24px,5.5vw,48px),max(20px,calc(100cqw/var(--handle-chars))))] leading-[1.25] [overflow-wrap:anywhere]"
          >
            {breakAfterUnderscores(name)}
          </Display>
          {user?.email ? (
            <Label tone="faint">{user.email}</Label>
          ) : (
            <Label tone="caution">No email — no password resets</Label>
          )}
        </header>

        {/* this season */}
        {enrolment ? (
          <>
            <section className="flex flex-wrap items-center gap-8">
              {enrolment.role === "player" ? (
                <div className="flex flex-col gap-2">
                  <Label tone="faint">Hearts</Label>
                  <Hearts
                    remaining={enrolment.heartsRemaining}
                    total={enrolment.heartsTotal}
                    size={20}
                  />
                </div>
              ) : null}

              <Stat
                icon="star"
                value={formatNumber(enrolment.nerve)}
                label="Nerve"
                tone="cyan"
                size="lg"
              />
              <Stat
                icon="opal"
                value={formatNumber(enrolment.coins)}
                label="Coins"
                tone="coin"
                size="lg"
              />
              {standing.data?.onBoard ? (
                <Stat
                  icon="trophy"
                  value={`#${standing.data.rank}`}
                  label={`of ${standing.data.total}`}
                  size="lg"
                />
              ) : null}
            </section>

            {enrolment.status !== "active" ? (
              <div className="flex flex-col gap-2">
                <Label tone={enrolment.status === "cheater" ? "heart" : "caution"}>
                  {enrolment.status === "cheater" ? "Cheater" : "Watcher now"}
                </Label>
                <Body size="sm">
                  {enrolment.demotionReason
                    ? DEMOTION_COPY[enrolment.demotionReason]
                    : "Your season as a player is over."}
                  {enrolment.demotedAt
                    ? ` ${formatAgo(enrolment.demotedAt)} ago.`
                    : ""}
                </Body>
              </div>
            ) : null}

            <Rule />
          </>
        ) : (
          <>
            <Body size="sm">
              You have not picked a side this season.
              {data?.rememberedRole
                ? ` We kept your choice of ${data.rememberedRole}.`
                : ""}
            </Body>
            <Link href="/join">
              <Button size="lg">Pick a side</Button>
            </Link>
            <Rule />
          </>
        )}

        {/* shortcuts */}
        <nav className="flex flex-col">
          {enrolment?.role === "watcher" ? null : (
            <RowLink href="/clan" icon="users" label="Clan" />
          )}
          <RowLink href="/vote" icon="eye" label="Vote" />
          <RowLink href="/shop" icon="cart" label="Purchases" />
          <RowLink
            href="/me/reports"
            icon="warning"
            label="Reports you filed"
            note={reports.data?.length ? String(reports.data.length) : undefined}
          />
        </nav>

        <Rule />

        {/* hand-ins */}
        <section className="flex flex-col gap-5">
          <Label>Your hand-ins</Label>
          {attempts.isLoading ? (
            <Loading />
          ) : (attempts.data?.length ?? 0) === 0 ? (
            <Body size="sm" className="text-ink-faint">
              Nothing handed in yet.
            </Body>
          ) : (
            <ul className="flex flex-col gap-4">
              {attempts.data?.map((attempt) => (
                <AttemptRow key={attempt.id} attempt={attempt} />
              ))}
            </ul>
          )}
        </section>

        <Rule />

        {/* out */}
        <div className="flex items-center justify-between gap-4 pb-6">
          <Label tone="faint">
            Account since{" "}
            {user?.createdAt ? new Date(user.createdAt).getFullYear() : "—"}
          </Label>
          <Button variant="quiet" marker={false} onClick={() => setConfirmingOut(true)}>
            Sign out
          </Button>
        </div>
      </Screen>

      <Dialog
        open={confirmingOut}
        title="Sign out?"
        confirmLabel="Sign out"
        cancelLabel="Stay"
        busy={logout.isPending}
        onCancel={() => setConfirmingOut(false)}
        onConfirm={() =>
          logout.mutate(undefined, {
            onSettled: () => {
              setConfirmingOut(false);
              router.push("/");
            },
          })
        }
      >
        Your clock keeps running while you are signed out.
      </Dialog>
    </main>
  );
}

/* ---------------------------------------------------------------- parts */

function RowLink({
  href,
  icon,
  label,
  note,
}: {
  href: string;
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  note?: string;
}) {
  return (
    <Link href={href} className="group flex items-center gap-4 py-4">
      <Icon
        name={icon}
        size="sm"
        className="opacity-50 transition-opacity group-hover:opacity-100"
      />
      <span className="flex-1 font-pixel text-[11px] uppercase tracking-[0.1em] text-ink-muted transition-colors group-hover:text-cyan">
        {label}
      </span>
      {note ? <Label tone="faint">{note}</Label> : null}
      <Icon
        name="arrow-right"
        size="xs"
        className="opacity-30 transition-all group-hover:translate-x-1 group-hover:opacity-80"
      />
    </Link>
  );
}

const ATTEMPT_TONE: Record<AttemptView["status"], string> = {
  awaiting_upload: "text-ink-faint",
  submitted: "text-caution",
  published: "text-good",
  rejected: "text-danger",
};

function AttemptRow({ attempt }: { attempt: AttemptView }) {
  const body = (
    <>
      <Icon
        name={attempt.kind === "video" ? "video" : "camera"}
        size="xs"
        dim={attempt.status === "rejected"}
      />
      <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-ink">
        Day {attempt.day}
      </span>
      <span
        className={cn(
          "flex-1 font-body text-[10px] uppercase tracking-[0.12em]",
          ATTEMPT_TONE[attempt.status],
        )}
      >
        {attempt.status.replace("_", " ")}
      </span>
      <Label tone="faint">{formatAgo(attempt.createdAt)}</Label>
    </>
  );

  // Only a published attempt is on the feed; linking the others would be a
  // link to a 404 wearing the clothes of a link to your own work.
  return attempt.status === "published" ? (
    <li>
      <Link
        href={`/feed/${attempt.id}`}
        className="flex items-center gap-4 py-1 transition-opacity hover:opacity-80"
      >
        {body}
      </Link>
    </li>
  ) : (
    <li className="flex items-center gap-4 py-1">{body}</li>
  );
}

/** `NIGHT_RUNNER` → `NIGHT_<wbr>RUNNER`: a polite place to wrap a handle. */
function breakAfterUnderscores(handle: string): ReactNode {
  return handle.split(/(?<=_)/).map((part, index) => (
    <Fragment key={index}>
      {index > 0 ? <wbr /> : null}
      {part}
    </Fragment>
  ));
}
