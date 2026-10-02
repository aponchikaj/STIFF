"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { Icon } from "@/components/icon";
import {
  Body,
  Empty,
  Label,
  Loading,
  Rule,
  Screen,
} from "@/components/ui";
import { SEASON_DAYS, type FeedItem, type SeasonDay } from "@/lib/api";
import {
  useAuthState,
  useFeedItems,
  useRecordShare,
  useToggleLike,
} from "@/lib/queries";
import { formatAgo, formatCompact, cn } from "@/lib/utils";

/**
 * `/feed` — what everyone else handed in.
 *
 * Public. This is the screen that sells the game, so it must be complete
 * and good-looking for someone who has never signed in. Nothing is gated;
 * the like button simply asks for an account when it is pressed.
 *
 * Media is edge-to-edge and the metadata sits over or under it rather than
 * in a card, because a bordered card on black would frame every clip as a
 * thumbnail. The feed should look like a screen playing, not a gallery.
 */
export default function FeedPage() {
  const [day, setDay] = useState<SeasonDay | undefined>(undefined);
  const feed = useFeedItems({ day, limit: 10 });

  // Infinite scroll. `rootMargin` fires the fetch a screen early so the
  // next page is usually already there by the time it is scrolled to.
  const { ref, inView } = useInView({ rootMargin: "600px" });
  useEffect(() => {
    if (inView && feed.hasNextPage && !feed.isFetchingNextPage) {
      void feed.fetchNextPage();
    }
  }, [inView, feed]);

  return (
    <main>
      {/* day filter — sticky, because the feed is long and the filter is
          the only way back out of day 3 */}
      <div className="sticky top-[53px] z-30 bg-void/85 backdrop-blur-sm">
        <Screen width="lg">
          <div className="flex items-center gap-6 py-3.5">
            <FilterChip active={day === undefined} onClick={() => setDay(undefined)}>
              All
            </FilterChip>
            {SEASON_DAYS.map((value) => (
              <FilterChip
                key={value}
                active={day === value}
                onClick={() => setDay(value)}
              >
                Day {value}
              </FilterChip>
            ))}
          </div>
        </Screen>
        <Rule />
      </div>

      <Screen width="lg" className="flex flex-col gap-14 py-8">
        {feed.isLoading ? (
          <Loading label="LOADING THE FEED" />
        ) : feed.items.length === 0 ? (
          <Empty icon="live" title="Nothing published yet">
            Hand-ins appear here once the watchers have judged them.
          </Empty>
        ) : (
          feed.items.map((item, index) => (
            <FeedCard key={item.id} item={item} priority={index < 2} />
          ))
        )}

        <div ref={ref} className="flex justify-center">
          {feed.isFetchingNextPage ? <Loading label="MORE" /> : null}
          {!feed.hasNextPage && feed.items.length > 0 ? (
            <Label tone="faint">That is all of it</Label>
          ) : null}
        </div>
      </Screen>
    </main>
  );
}

/* ----------------------------------------------------------------- card */

function FeedCard({ item, priority }: { item: FeedItem; priority: boolean }) {
  const router = useRouter();
  const { isSignedIn } = useAuthState();
  const like = useToggleLike();

  const cheater = item.player.status === "cheater";

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      {/* who */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Icon name={cheater ? "skull" : "profile"} size="xs" glow={!cheater} />
          <span
            className={cn(
              "truncate font-pixel text-[11px] uppercase tracking-[0.1em]",
              cheater ? "text-danger" : "text-ink",
            )}
          >
            {item.player.handle}
          </span>
          {cheater ? (
            <span className="shrink-0 font-pixel text-[8px] uppercase tracking-[0.1em] text-danger">
              Cheater
            </span>
          ) : (
            <span className="shrink-0 font-pixel text-[9px] tabular-nums text-cyan">
              {formatCompact(item.player.nerve)}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <Label tone="faint">Day {item.day}</Label>
          <Label tone="faint">{formatAgo(item.publishedAt)}</Label>
        </div>
      </header>

      {/* the proof */}
      <Link href={`/feed/${item.id}`} className="group relative block">
        <div className="scanlines relative overflow-hidden bg-surface">
          {item.mediaUrl ? (
            item.kind === "video" ? (
              <video
                src={item.mediaUrl}
                controls
                playsInline
                preload={priority ? "metadata" : "none"}
                className="max-h-[70dvh] w-full object-contain"
              />
            ) : (
              // Hand-ins are user media on an unknown host at an unknown
              // size; next/image would need every bucket in remotePatterns
              // and buys nothing over the browser's own lazy loading here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.mediaUrl}
                alt={item.caption ?? `Hand-in by ${item.player.handle}`}
                loading={priority ? "eager" : "lazy"}
                className="max-h-[70dvh] w-full object-contain transition-transform duration-500 group-hover:scale-[1.01]"
              />
            )
          ) : (
            <div className="flex h-56 items-center justify-center">
              <Icon name="warning" size="lg" className="opacity-30" />
            </div>
          )}
        </div>
      </Link>

      {item.caption ? <Body size="sm">{item.caption}</Body> : null}

      {/* actions */}
      <footer className="flex items-center gap-7">
        <button
          type="button"
          // Not disabled when signed out — a dead heart teaches nothing.
          // Pressing it is the best moment to ask for an account, so it
          // routes to sign-in and comes back here.
          onClick={() => {
            if (!isSignedIn) {
              router.push(`/login?next=/feed/${item.id}`);
              return;
            }
            like.mutate(item.id);
          }}
          aria-label={item.likedByMe ? "Unlike" : "Like"}
          aria-pressed={item.likedByMe ?? false}
          className="group flex items-center gap-2.5 py-1"
        >
          <motion.span whileTap={{ scale: 0.8 }} transition={{ duration: 0.1 }}>
            <Icon
              name={item.likedByMe ? "filled-heart" : "outline-heart"}
              size="sm"
              glow={item.likedByMe ? "heart" : undefined}
              // likedByMe is null for an anonymous reader — that is "we did
              // not ask", not "no". Render it neither lit nor crossed out.
              dim={item.likedByMe === false}
              className="transition-transform duration-200 group-hover:scale-110"
            />
          </motion.span>
          <span className="font-pixel text-[10px] tabular-nums text-ink-muted">
            {formatCompact(item.likeCount)}
          </span>
        </button>

        <Link href={`/feed/${item.id}`} className="group flex items-center gap-2.5 py-1">
          <Icon
            name="chat"
            size="sm"
            className="opacity-60 transition-opacity group-hover:opacity-100"
          />
          <span className="font-pixel text-[10px] tabular-nums text-ink-muted">
            {formatCompact(item.commentCount)}
          </span>
        </Link>

        <ShareButton item={item} />
      </footer>
    </motion.article>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "font-pixel text-[10px] uppercase tracking-[0.12em] transition-all duration-200",
        active
          ? "text-cyan [text-shadow:var(--glow-cyan)]"
          : "text-ink-faint hover:text-ink-muted",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Share.
 *
 * Uses the OS sheet when there is one — on a phone that is the whole
 * point, since Instagram has no web API for Stories and the native sheet
 * is the only route into one. Falls back to copying the link. The count is
 * recorded either way, and works signed out.
 */
function ShareButton({ item }: { item: FeedItem }) {
  const [copied, setCopied] = useState(false);
  const record = useRecordShare();

  async function share() {
    const url = item.shareUrl;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "STIFF", url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // A cancelled share sheet throws, and a cancelled share is not a
      // share — return before counting it.
      return;
    }
    record.mutate(item.id);
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      aria-label="Share"
      className="group ml-auto flex items-center gap-2.5 py-1"
    >
      <Icon
        name="send"
        size="sm"
        className="opacity-60 transition-opacity group-hover:opacity-100"
      />
      <span className="font-pixel text-[10px] uppercase tracking-[0.1em] text-ink-muted">
        {copied ? "Copied" : formatCompact(item.shareCount)}
      </span>
    </button>
  );
}
