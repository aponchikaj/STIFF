"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { BackLink } from "@/components/nav";
import { Empty, Label, Loading, Screen } from "@/components/ui";
import type { FeedItem } from "@/lib/api";
import { useFeedItems, usePlayerSearch } from "@/lib/queries";
import { cn, formatCompact } from "@/lib/utils";

/**
 * `/u/<handle>` — a player, from the feed's avatar or their @handle.
 *
 * Who they are on the board — nerve, rank, standing — and a grid of what
 * they handed in. Tapping a post opens the reel on it, filtered to them,
 * so swiping carries on through their posts rather than everyone's.
 */
export default function PlayerPage() {
  const params = useParams<{ handle: string }>();
  const handle = decodeURIComponent(params?.handle ?? "");

  const search = usePlayerSearch(handle);
  const posts = useFeedItems({ player: handle, limit: 24 });

  const player =
    search.data?.find((p) => p.handle.toLowerCase() === handle.toLowerCase()) ?? null;
  const fromPosts = posts.items[0]?.player ?? null;
  const shownHandle = player?.handle ?? fromPosts?.handle ?? handle;
  const nerve = player?.nerve ?? fromPosts?.nerve ?? null;
  const status = player?.status ?? fromPosts?.status ?? null;
  const cheater = status === "cheater";

  const loading = posts.isLoading || (search.isLoading && handle.length >= 2);
  const unknown = !loading && !player && posts.items.length === 0;

  return (
    <main>
      <Screen width="md" className="flex flex-col gap-8 py-4">
        <BackLink href="/feed">Feed</BackLink>

        {loading ? (
          <Loading label="FINDING THEM" />
        ) : unknown ? (
          <Empty icon="profile" title="No such player">
            Nobody plays under @{handle} this season.
          </Empty>
        ) : (
          <>
            {/* who */}
            <motion.header
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-5 text-center"
            >
              <span className={cn("block", cheater ? "bloom-danger" : "bloom-cyan-lg")}>
                <span
                  className={cn(
                    "flex size-24 items-center justify-center font-pixel text-[40px] uppercase frame-notch-lg",
                    cheater ? "bg-heart-dim" : "bg-blue-deep",
                  )}
                >
                  {shownHandle.slice(0, 1)}
                </span>
              </span>

              <div className="flex flex-col items-center gap-2">
                <span
                  className={cn(
                    "font-pixel text-[16px] uppercase tracking-[0.08em]",
                    cheater ? "text-danger" : "text-ink text-glow",
                  )}
                >
                  @{shownHandle}
                </span>
                {cheater ? (
                  <Label tone="heart">Marked a cheater</Label>
                ) : status === "demoted" ? (
                  <Label tone="faint">Watching now</Label>
                ) : null}
              </div>

              <div className="grid w-full max-w-sm grid-cols-3">
                <Stat label="Nerve" value={nerve === null ? "—" : formatCompact(nerve)} tone="cyan" />
                <Stat label="Rank" value={player?.rank ? `#${player.rank}` : "—"} />
                <Stat
                  label="Posts"
                  value={`${posts.items.length}${posts.hasNextPage ? "+" : ""}`}
                />
              </div>
            </motion.header>

            {/* what they handed in */}
            {posts.items.length === 0 ? (
              <Empty icon="video" title="No posts yet">
                Nothing of theirs has been judged and published yet.
              </Empty>
            ) : (
              <section className="grid grid-cols-3 gap-1">
                {posts.items.map((item, index) => (
                  <Tile key={item.id} item={item} handle={shownHandle} index={index} />
                ))}
              </section>
            )}

            {posts.hasNextPage ? (
              <button
                type="button"
                onClick={() => void posts.fetchNextPage()}
                disabled={posts.isFetchingNextPage}
                className="self-center py-3 font-pixel text-[10px] uppercase tracking-[0.14em] text-blue hover:text-cyan disabled:opacity-40"
              >
                {posts.isFetchingNextPage ? "Loading ▮" : "More"}
              </button>
            ) : null}
          </>
        )}
      </Screen>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "cyan" }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          "font-pixel text-[18px] tabular-nums",
          tone === "cyan" ? "text-cyan text-glow-cyan" : "text-ink",
        )}
      >
        {value}
      </span>
      <span className="font-body text-[10px] uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </span>
    </div>
  );
}

/** One post as a 9:16 tile: its first frame, the task, its likes. */
function Tile({ item, handle, index }: { item: FeedItem; handle: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.03 }}
    >
      <Link
        href={`/feed?player=${encodeURIComponent(handle)}&v=${item.id}`}
        className="group relative block aspect-[9/16] overflow-hidden bg-surface scanlines"
        aria-label={item.task ? `${item.task.title} by ${handle}` : `Post by ${handle}`}
      >
        {item.mediaUrl ? (
          item.kind === "video" ? (
            // `#t=0.1` asks for a frame a beat in, so the tile is not the
            // black first frame many phones record.
            <video
              src={`${item.mediaUrl}#t=0.1`}
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.mediaUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-void/90 to-transparent p-2 pt-8">
          {item.task ? (
            <span className="line-clamp-2 font-pixel text-[8px] uppercase leading-[11px] tracking-[0.06em] text-ink">
              {item.task.title}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Icon name="filled-heart" size="xs" />
            <span className="font-pixel text-[8px] tabular-nums text-ink">
              {formatCompact(item.likeCount)}
            </span>
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
