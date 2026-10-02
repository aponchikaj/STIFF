"use client";

import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { CommentThread } from "@/components/comments";
import { FeedTaskDetails, FeedTaskTitle } from "@/components/feed-task";
import { Icon } from "@/components/icon";
import { BackLink } from "@/components/nav";
import { Body, Empty, Label, Loading, Rule, Screen } from "@/components/ui";
import { useFeedItem, useToggleLike } from "@/lib/queries";
import { cn, formatAgo, formatCompact } from "@/lib/utils";

/**
 * One hand-in: the task it was proof of, the clip, and its comments.
 *
 * The thread is `CommentThread`, shared with the sheet that opens over the
 * feed — the cheater notice and the delete rule live there, once.
 */
export default function FeedItemPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const item = useFeedItem(id);
  const like = useToggleLike();

  if (item.isLoading) {
    return (
      <Screen width="md">
        <Loading />
      </Screen>
    );
  }

  if (item.isError || !item.data) {
    return (
      <Screen width="md">
        <BackLink href="/feed" />
        <Empty icon="warning" title="Not here">
          This hand-in was taken down, or never existed.
        </Empty>
      </Screen>
    );
  }

  const data = item.data;
  const cheater = data.player.status === "cheater";

  return (
    <main>
      <Screen width="md" className="flex flex-col gap-7 py-4">
        <BackLink href="/feed" />

        {/* who */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Icon name={cheater ? "skull" : "profile"} size="sm" glow={!cheater} />
            <div className="flex min-w-0 flex-col gap-1">
              <span
                className={cn(
                  "truncate font-pixel text-[12px] uppercase tracking-[0.1em]",
                  cheater ? "text-danger" : "text-ink text-glow",
                )}
              >
                {data.player.handle}
              </span>
              <Label tone="faint">
                Day {data.day} · {formatAgo(data.publishedAt)}
              </Label>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Icon name="star" size="xs" glow />
            <span className="font-pixel text-[11px] tabular-nums text-cyan text-glow-cyan-xs">
              {formatCompact(data.player.nerve)}
            </span>
          </div>
        </header>

        {/* the dare */}
        {data.task ? <FeedTaskTitle task={data.task} day={data.day} size="lg" /> : null}

        {/* the proof */}
        <div className="scanlines relative overflow-hidden bg-surface">
          {data.mediaUrl ? (
            data.kind === "video" ? (
              <video
                src={data.mediaUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[70dvh] w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.mediaUrl}
                alt={data.caption ?? `Hand-in by ${data.player.handle}`}
                className="max-h-[70dvh] w-full object-contain"
              />
            )
          ) : (
            <div className="flex h-56 items-center justify-center">
              <Icon name="warning" size="lg" className="opacity-30" />
            </div>
          )}
        </div>

        {data.caption ? <Body className="text-ink">{data.caption}</Body> : null}

        {data.task ? <FeedTaskDetails task={data.task} defaultOpen /> : null}

        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => like.mutate(data.id)}
            aria-label={data.likedByMe ? "Unlike" : "Like"}
            aria-pressed={data.likedByMe ?? false}
            className="group flex items-center gap-2.5"
          >
            <motion.span whileTap={{ scale: 0.8 }}>
              <Icon
                name={data.likedByMe ? "filled-heart" : "outline-heart"}
                size="sm"
                glow={data.likedByMe ? "heart" : undefined}
                dim={data.likedByMe === false}
              />
            </motion.span>
            <span className="font-pixel text-[11px] tabular-nums text-ink-muted">
              {formatCompact(data.likeCount)}
            </span>
          </button>

          <div className="flex items-center gap-2.5">
            <Icon name="chat" size="sm" className="opacity-60" />
            <span className="font-pixel text-[11px] tabular-nums text-ink-muted">
              {formatCompact(data.commentCount)}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <Icon name="send" size="sm" className="opacity-60" />
            <span className="font-pixel text-[11px] tabular-nums text-ink-muted">
              {formatCompact(data.shareCount)}
            </span>
          </div>
        </div>

        <Rule />

        {/* comments */}
        <CommentThread
          attemptId={id}
          count={data.commentCount}
          returnTo={`/feed/${id}`}
        />
      </Screen>
    </main>
  );
}
