"use client";

/**
 * The top of /me: who you are, and how your season stands.
 *
 * Two identities, kept visibly apart because they are different things:
 * the **account** (your sign-in, permanent, the shop's too) and the
 * **enrolment** (this season's handle and side, which can be demoted or
 * marked a cheater). The identity card shows both; the season card is the
 * enrolment's numbers and the one thing to do next.
 *
 * Colour follows the side, as on the title screen: a watcher is blue, a
 * player is the heart's red — the one with hearts to lose.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { Hearts } from "@/components/ui";
import type { Dashboard, DemotionReason, Standing } from "@/lib/api";
import { useResendVerification } from "@/lib/queries";
import { cn, formatAgo, formatNumber } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

const DEMOTION: Record<DemotionReason, string> = {
  cheating: "Marked a cheater. That is final for this season.",
  missed_daily_minimum: "You missed a day's minimum, so the season moved you to the audience.",
  zero_balance: "Your opal balance hit zero.",
  out_of_hearts: "You ran out of hearts.",
};

/* ============================================================ identity */

export function IdentityCard({ data }: { data: Dashboard }) {
  const { user, enrolment } = data;
  const handle = enrolment?.handle ?? user.username;
  const cheater = enrolment?.status === "cheater";
  const player = enrolment?.role === "player" && enrolment.status === "active";
  const tone = cheater ? "danger" : player ? "heart" : "blue";

  const roleWord = !enrolment
    ? "No side yet"
    : cheater
      ? "Cheater"
      : enrolment.status === "demoted"
        ? "Watcher · demoted"
        : enrolment.role === "player"
          ? "Player"
          : "Watcher";

  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="relative flex flex-col items-center gap-5 pb-2 pt-6 text-center sm:flex-row sm:items-center sm:gap-7 sm:text-left"
    >
      {/* the mark */}
      <span
        className={cn(
          "block shrink-0",
          tone === "danger" ? "bloom-danger" : tone === "heart" ? "[filter:drop-shadow(0_0_3px_rgb(255_77_94/0.9))_drop-shadow(0_0_16px_rgb(255_77_94/0.45))]" : "bloom-cyan-lg",
        )}
      >
        <motion.span
          initial={{ scale: 0.7, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.1 }}
          className={cn(
            "flex size-24 items-center justify-center font-pixel text-[42px] uppercase text-ink frame-notch-lg scanlines sm:size-28 sm:text-[48px]",
            tone === "danger" ? "bg-danger/40" : tone === "heart" ? "bg-heart-dim" : "bg-blue-deep",
          )}
        >
          {handle.slice(0, 1)}
        </motion.span>
      </span>

      <div
        // `w-full`: an inline-size container has no width of its own, so in
        // the centred phone column it would shrink to nothing without one.
        className="flex w-full min-w-0 flex-1 flex-col items-center gap-2.5 [container-type:inline-size] sm:w-auto sm:items-start"
        // +2: the "@", and slack for the face's 0.02em letter-spacing.
        style={{ "--handle-chars": handle.length + 2 } as CSSProperties}
      >
        <span
          className={cn(
            "px-2 py-1 font-pixel text-[8px] uppercase tracking-[0.16em] frame-notch",
            tone === "danger" && "bg-danger text-void",
            tone === "heart" && "bg-heart text-void",
            tone === "blue" && "bg-blue text-void",
          )}
        >
          {roleWord}
        </span>

        {/* A handle is up to 24 unbroken characters in a 1em-per-glyph face:
            sized to fill the column exactly, never past the title size, and
            wrapping after an underscore once it would drop below 18px. */}
        <h1
          className={cn(
            "max-w-full font-display uppercase leading-[1.15] pixel-snap [overflow-wrap:anywhere]",
            "text-[length:min(clamp(24px,6vw,44px),max(18px,calc(100cqw/var(--handle-chars))))]",
            cheater ? "text-danger" : "text-ink text-glow",
          )}
        >
          @{breakAfterUnderscores(handle)}
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 sm:justify-start">
          {data.season ? (
            <span className="font-body text-[11px] uppercase tracking-[0.12em] text-ink-muted">
              {data.season.title}
            </span>
          ) : null}
          <span className="font-body text-[11px] uppercase tracking-[0.12em] text-ink-faint">
            Since {new Date(user.createdAt).getFullYear()}
          </span>
          {enrolment ? (
            <Link
              href={`/u/${encodeURIComponent(enrolment.handle)}`}
              className="font-pixel text-[9px] uppercase tracking-[0.12em] text-blue hover:text-cyan"
            >
              Public profile ▶
            </Link>
          ) : null}
        </div>

        <EmailLine email={user.email} verified={user.isVerified} />
      </div>
    </motion.header>
  );
}

/** The address, and a nudge — the only way back into a lost account. */
function EmailLine({ email, verified }: { email: string | null; verified: boolean }) {
  const resend = useResendVerification();

  if (!email) {
    return (
      <span className="inline-flex items-center gap-2 font-body text-[12px] text-caution">
        <Icon name="warning" size="xs" />
        No email — add one in Account, or a lost password is a lost account.
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-body text-[12px] text-ink-muted sm:justify-start">
      <span className="break-all">{email}</span>
      {verified ? (
        <span className="text-good">Verified</span>
      ) : resend.isSuccess ? (
        <span className="text-good">Link sent — check your inbox</span>
      ) : (
        <button
          type="button"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
          className="text-caution underline-offset-4 hover:underline disabled:opacity-50"
        >
          {resend.isPending ? "Sending…" : "Not verified · send the link"}
        </button>
      )}
    </span>
  );
}

/* ============================================================== season */

export function SeasonCard({
  data,
  standing,
}: {
  data: Dashboard;
  standing: Standing | undefined;
}) {
  const { enrolment, today } = data;

  // No side this season.
  if (!enrolment) {
    return (
      <Card tone="blue" delay={0.1}>
        <div className="flex flex-col items-center gap-4 px-5 py-7 text-center">
          <Icon name="game" size="xl" glow />
          <p className="font-pixel text-[13px] uppercase tracking-[0.1em] text-ink">
            Pick a side to play
          </p>
          <p className="max-w-sm font-body text-body-sm leading-[20px] text-ink-muted">
            Player or watcher — one per season.
            {data.rememberedRole ? ` We kept your choice of ${data.rememberedRole}.` : ""}
          </p>
          <CardLink href="/join" tone="blue">
            Pick a side
          </CardLink>
        </div>
      </Card>
    );
  }

  const player = enrolment.role === "player" && enrolment.status === "active";
  const fell = enrolment.status !== "active";

  return (
    <Card tone={enrolment.status === "cheater" ? "danger" : player ? "heart" : "blue"} delay={0.1}>
      <div className="flex flex-col gap-6 px-5 py-6 sm:px-7">
        {/* the fall, said first when it happened */}
        {fell ? (
          <div
            className={cn(
              "flex items-start gap-3 px-3.5 py-3 frame-notch",
              enrolment.status === "cheater" ? "bg-danger/15" : "bg-caution/10",
            )}
          >
            <Icon
              name={enrolment.status === "cheater" ? "skull" : "broken-heart"}
              size="sm"
              glow={enrolment.status === "cheater" ? undefined : "heart"}
            />
            <p className="font-body text-body-sm leading-[19px] text-ink-muted">
              {enrolment.demotionReason
                ? DEMOTION[enrolment.demotionReason]
                : "Your season as a player is over."}
              {enrolment.demotedAt ? ` ${formatAgo(enrolment.demotedAt)} ago.` : ""}{" "}
              {enrolment.status === "cheater" ? "" : "You still earn opals by voting."}
            </p>
          </div>
        ) : null}

        {/* the numbers */}
        <div className="grid grid-cols-3 gap-3">
          <Number label="Nerve" value={formatNumber(enrolment.nerve)} icon="star" tone="cyan" />
          <Number label="Opals" value={formatNumber(enrolment.coins)} icon="opal" tone="coin" href="/shop" />
          <Number
            label={standing?.onBoard ? `Rank of ${formatNumber(standing.total)}` : "Rank"}
            value={standing?.onBoard && standing.rank ? `#${standing.rank}` : "—"}
            icon="trophy"
            href="/board"
          />
        </div>

        {/* a player's lives and today's count */}
        {player ? (
          <div className="flex flex-col gap-4 border-t border-blue-dim/40 pt-5">
            <div className="flex items-center justify-between gap-4">
              <span className="font-body text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                Hearts
              </span>
              <Hearts remaining={enrolment.heartsRemaining} total={enrolment.heartsTotal} size={22} />
            </div>
            {today ? <TodayBar done={today.handedIn} needed={today.minimum} /> : null}
          </div>
        ) : null}

        {/* the one thing to do next */}
        {player ? (
          <CardLink href="/play" tone="heart">
            ▶ Play today&apos;s opal
          </CardLink>
        ) : enrolment.status !== "cheater" ? (
          <CardLink href="/vote" tone="blue">
            ▶ Vote and earn opals
          </CardLink>
        ) : null}
      </div>
    </Card>
  );
}

/** Today's hand-ins against the nightly minimum — the number that ends seasons. */
function TodayBar({ done, needed }: { done: number; needed: number }) {
  const met = done >= needed;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-body text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          Today
        </span>
        <span className={cn("font-pixel text-[10px] tabular-nums", met ? "text-good" : "text-caution")}>
          {met ? "Minimum met" : `${done} of ${needed} handed in`}
        </span>
      </div>
      <div className="flex gap-1.5" role="img" aria-label={`${done} of ${needed} handed in today`}>
        {Array.from({ length: Math.max(needed, 1) }, (_, i) => (
          <motion.span
            key={i}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.4, delay: 0.3 + i * 0.08, ease: EASE }}
            className={cn(
              "h-2 flex-1 origin-left",
              i < done ? "bg-good shadow-[0_0_8px_rgb(47_217_107/0.8)]" : "bg-surface-3",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* ================================================================ parts */

type Tone = "blue" | "heart" | "danger";

/** A notched card with a hairline in its tone. */
export function Card({
  tone = "blue",
  delay = 0,
  className,
  children,
}: {
  tone?: Tone | "quiet";
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: EASE }}
      className={className}
    >
      <div
        className={cn(
          "p-px frame-notch-lg",
          tone === "blue" && "bg-blue-dim/80",
          tone === "heart" && "bg-heart-dim",
          tone === "danger" && "bg-danger/60",
          tone === "quiet" && "bg-blue-dim/40",
        )}
      >
        <div className="bg-surface-2 frame-notch-lg">{children}</div>
      </div>
    </motion.section>
  );
}

function CardLink({ href, tone, children }: { href: string; tone: Tone; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "block py-3.5 text-center font-pixel text-[12px] uppercase tracking-[0.12em] text-void frame-notch transition-[filter] hover:brightness-110",
        tone === "heart" ? "bg-heart" : tone === "danger" ? "bg-danger" : "bg-blue",
      )}
    >
      {children}
    </Link>
  );
}

function Number({
  label,
  value,
  icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  icon: "star" | "opal" | "trophy";
  tone?: "cyan" | "coin";
  href?: string;
}) {
  const body = (
    <>
      <Icon name={icon} size="sm" glow={tone === "coin" ? "coin" : true} />
      <span
        className={cn(
          "font-pixel text-[clamp(16px,5vw,22px)] leading-none tabular-nums",
          tone === "cyan" ? "text-cyan text-glow-cyan" : tone === "coin" ? "text-coin text-glow-coin" : "text-ink text-glow-xs",
        )}
      >
        {value}
      </span>
      <span className="font-body text-[9px] uppercase tracking-[0.14em] text-ink-faint">{label}</span>
    </>
  );
  const cls = "flex flex-col items-center gap-2 bg-surface-3/60 px-2 py-4 text-center frame-notch";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-surface-3")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
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
