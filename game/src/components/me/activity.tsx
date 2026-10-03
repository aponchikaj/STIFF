"use client";

/**
 * The middle of /me: where to go, what happened, what you handed in.
 *
 *   Shortcuts  four tiles — the places a profile is a way into
 *   Inbox      the latest notifications, unread lit, one tap to open
 *   Hand-ins   everything you uploaded, as tiles, with where each one is
 */

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import type { AttemptStatus, AttemptView, NotificationView } from "@/lib/api";
import type { IconName } from "@/lib/icons";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMyAttempts,
  useMyReports,
  useNotifications,
} from "@/lib/queries";
import { cn, formatAgo, formatNumber } from "@/lib/utils";
import { Card } from "./header";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ============================================================ shortcuts */

export function Shortcuts({
  handle,
  coins,
}: {
  handle: string | null;
  coins: number | null;
}) {
  const reports = useMyReports();
  const filed = reports.data?.length ?? 0;

  const tiles: { href: string; icon: IconName; label: string; note?: string }[] = [
    { href: "/shop", icon: "cart", label: "Shop", note: coins !== null ? `${formatNumber(coins)} opals` : undefined },
    { href: "/board", icon: "trophy", label: "Board", note: "Where you stand" },
    handle
      ? { href: `/u/${encodeURIComponent(handle)}`, icon: "video", label: "Your posts", note: "As others see them" }
      : { href: "/feed", icon: "live", label: "Feed", note: "What got through" },
    { href: "/me/reports", icon: "warning", label: "Reports", note: filed ? `${filed} filed` : "None filed" },
  ];

  return (
    <motion.nav
      aria-label="Shortcuts"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.18, ease: EASE }}
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
    >
      {tiles.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="group flex flex-col gap-3 bg-surface-2 px-4 py-4 frame-notch transition-colors hover:bg-surface-3"
        >
          <span className="flex items-center justify-between">
            <Icon name={t.icon} size="sm" className="opacity-70 transition-opacity group-hover:opacity-100" />
            <span
              aria-hidden
              className="font-pixel text-[9px] text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-cyan"
            >
              ▶
            </span>
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-ink transition-colors group-hover:text-cyan">
              {t.label}
            </span>
            {t.note ? (
              <span className="truncate font-body text-[11px] text-ink-faint">{t.note}</span>
            ) : null}
          </span>
        </Link>
      ))}
    </motion.nav>
  );
}

/* ================================================================ inbox */

export function Inbox() {
  const router = useRouter();
  const inbox = useNotifications({ pageSize: 6 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = inbox.data?.items ?? [];
  const unread = inbox.data?.unreadCount ?? 0;

  function open(n: NotificationView) {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) router.push(n.link);
  }

  return (
    <Card tone="quiet" delay={0.24}>
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Icon name="notify" size="sm" glow={unread > 0} dim={unread === 0} />
            <span className="font-pixel text-[11px] uppercase tracking-[0.1em] text-ink">Inbox</span>
            {unread > 0 ? (
              <span className="min-w-5 bg-heart px-1.5 py-0.5 text-center font-pixel text-[8px] tabular-nums text-void frame-notch">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </div>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="font-body text-[11px] uppercase tracking-[0.12em] text-blue hover:text-cyan disabled:opacity-40"
            >
              Mark all read
            </button>
          ) : null}
        </div>

        {inbox.isLoading ? (
          <p className="px-6 pb-6 font-pixel text-[9px] uppercase tracking-[0.14em] text-blue">
            Reading <span className="animate-[blink_0.7s_steps(2,end)_infinite]">▮</span>
          </p>
        ) : items.length === 0 ? (
          <p className="px-5 pb-6 font-body text-body-sm text-ink-faint sm:px-6">
            Nothing yet. Verdicts on your hand-ins, opal payouts, lost hearts
            and what happened to your reports all land here.
          </p>
        ) : (
          <ul className="flex flex-col pb-2">
            <AnimatePresence initial={false}>
              {items.map((n) => (
                <motion.li key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-3 sm:px-6",
                      !n.readAt && "bg-blue-dim/15",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0",
                        n.readAt ? "bg-transparent" : "bg-cyan shadow-[var(--glow-cyan-sm)]",
                      )}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className={cn("font-body text-body-sm leading-[18px]", n.readAt ? "text-ink-muted" : "text-ink")}>
                        {n.title}
                      </span>
                      {n.body ? (
                        <span className="line-clamp-2 font-body text-[12px] leading-[16px] text-ink-faint">
                          {n.body}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-body text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                      {formatAgo(n.createdAt)}
                    </span>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ============================================================== hand-ins */

const STATUS: Record<AttemptStatus, { word: string; cls: string }> = {
  awaiting_upload: { word: "Upload unfinished", cls: "bg-surface-3 text-ink-faint" },
  submitted: { word: "Being judged", cls: "bg-caution text-void" },
  published: { word: "On the feed", cls: "bg-good text-void" },
  rejected: { word: "Rejected", cls: "bg-heart text-void" },
};

export function HandIns({ playing }: { playing: boolean }) {
  const attempts = useMyAttempts();
  const list = attempts.data ?? [];

  const counts = list.reduce(
    (acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }),
    {} as Partial<Record<AttemptStatus, number>>,
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.3, ease: EASE }}
      className="flex flex-col gap-4"
      aria-label="Your hand-ins"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <span className="font-pixel text-[11px] uppercase tracking-[0.1em] text-ink">
          Your hand-ins {list.length ? <span className="text-ink-faint">· {list.length}</span> : null}
        </span>
        {list.length ? (
          <span className="flex flex-wrap gap-x-3 gap-y-1 font-body text-[10px] uppercase tracking-[0.12em]">
            {counts.published ? <span className="text-good">{counts.published} on the feed</span> : null}
            {counts.submitted ? <span className="text-caution">{counts.submitted} being judged</span> : null}
            {counts.rejected ? <span className="text-heart">{counts.rejected} rejected</span> : null}
          </span>
        ) : null}
      </div>

      {attempts.isLoading ? (
        <p className="font-pixel text-[9px] uppercase tracking-[0.14em] text-blue">Loading ▮</p>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 bg-surface-2 px-5 py-8 text-center frame-notch">
          <Icon name="camera" size="lg" dim />
          <p className="font-body text-body-sm text-ink-muted">
            {playing ? "Nothing handed in yet. Your first task is waiting." : "Nothing handed in."}
          </p>
          {playing ? (
            <Link href="/play" className="font-pixel text-[10px] uppercase tracking-[0.12em] text-blue hover:text-cyan">
              ▶ Go to the opals
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {list.map((a, i) => (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.35 + Math.min(i, 12) * 0.03 }}
            >
              <AttemptTile attempt={a} />
            </motion.li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

function AttemptTile({ attempt }: { attempt: AttemptView }) {
  const status = STATUS[attempt.status];
  const inner = (
    <>
      {attempt.mediaUrl ? (
        attempt.kind === "video" ? (
          <video
            src={`${attempt.mediaUrl}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            className={cn("absolute inset-0 size-full object-cover", attempt.status === "rejected" && "opacity-40 grayscale")}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attempt.mediaUrl}
            alt=""
            loading="lazy"
            className={cn("absolute inset-0 size-full object-cover", attempt.status === "rejected" && "opacity-40 grayscale")}
          />
        )
      ) : (
        <span className="absolute inset-0 flex items-center justify-center">
          <Icon name={attempt.kind === "video" ? "video" : "camera"} size="sm" dim />
        </span>
      )}
      <span className="absolute inset-x-0 top-0 flex items-center justify-between p-1.5">
        <span className="bg-void/60 px-1.5 py-0.5 font-pixel text-[7px] uppercase tracking-[0.1em] text-ink backdrop-blur-sm frame-notch">
          {String(attempt.day).padStart(3, "0")}
        </span>
        <span className="font-body text-[9px] text-ink [text-shadow:0_1px_2px_rgb(0_0_0/0.9)]">
          {formatAgo(attempt.createdAt)}
        </span>
      </span>
      <span className="absolute inset-x-0 bottom-0 p-1.5">
        <span className={cn("block truncate px-1.5 py-1 text-center font-pixel text-[7px] uppercase tracking-[0.08em] frame-notch", status.cls)}>
          {status.word}
        </span>
      </span>
    </>
  );

  const cls = "group relative block aspect-[9/16] overflow-hidden bg-surface-2 scanlines";
  // Only a published hand-in is on the feed; a link to anything else would
  // be a link to a 404.
  return attempt.status === "published" ? (
    <Link href={`/feed/${attempt.id}`} className={cn(cls, "transition-[filter] hover:brightness-110")} aria-label={`Hand-in for opal ${attempt.day}, on the feed`}>
      {inner}
    </Link>
  ) : (
    <div className={cls} aria-label={`Hand-in for opal ${attempt.day}: ${status.word}`}>
      {inner}
    </div>
  );
}
