"use client";

import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { BackLink } from "@/components/nav";
import {
  Body,
  Button,
  Empty,
  ErrorNote,
  Label,
  Loading,
  Rule,
  Screen,
} from "@/components/ui";
import type { ApiError, CommentView } from "@/lib/api";
import {
  useAddComment,
  useAuthState,
  useComments,
  useFeedItem,
  useRemoveComment,
  useToggleLike,
} from "@/lib/queries";
import { cn, formatAgo, formatCompact } from "@/lib/utils";

/**
 * One hand-in, with its comments.
 *
 * The notable rule here is the cheater notice. `authorStatus` is read at
 * render time rather than snapshotted when the comment was written, so the
 * moment an account is marked a cheater every comment it ever left says
 * so. The backend sends the exact wording in `notice`; we render that
 * string rather than composing our own, so there is one phrasing of it.
 */
export default function FeedItemPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const item = useFeedItem(id);
  const comments = useComments(id);
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

        {data.caption ? <Body>{data.caption}</Body> : null}

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
        <section className="flex flex-col gap-6">
          <Label>
            {data.commentCount === 1 ? "1 comment" : `${data.commentCount} comments`}
          </Label>

          <CommentComposer attemptId={id} />

          {comments.isLoading ? (
            <Loading />
          ) : (comments.data?.length ?? 0) === 0 ? (
            <Body size="sm" className="py-6 text-ink-faint">
              Nothing said yet.
            </Body>
          ) : (
            <ul className="flex flex-col gap-6">
              {comments.data?.map((comment) => (
                <CommentRow key={comment.id} comment={comment} attemptId={id} />
              ))}
            </ul>
          )}
        </section>
      </Screen>
    </main>
  );
}

/* ------------------------------------------------------------- comments */

function CommentComposer({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const { isSignedIn } = useAuthState();
  const add = useAddComment(attemptId);
  const [body, setBody] = useState("");

  if (!isSignedIn) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/login?next=/feed/${attemptId}`)}
        className="py-3 text-left font-body text-caption uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-cyan"
      >
        Sign in to say something
      </button>
    );
  }

  const error = add.error as ApiError | null;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = body.trim();
        if (!trimmed) return;
        add.mutate(trimmed, { onSuccess: () => setBody("") });
      }}
    >
      <div className="flex items-end gap-4">
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={500}
          placeholder="SAY SOMETHING"
          className="flex-1 border-b border-blue-dim bg-transparent pb-2.5 font-pixel text-[11px] uppercase tracking-[0.08em] text-ink outline-none transition-all placeholder:text-ink-faint/50 focus:border-cyan focus:[box-shadow:0_1px_0_0_rgb(1_231_255/0.6)]"
        />
        <Button
          type="submit"
          size="sm"
          marker={false}
          icon="send"
          loading={add.isPending}
          disabled={!body.trim()}
        >
          Send
        </Button>
      </div>
      {error ? <ErrorNote>{error.message}</ErrorNote> : null}
    </form>
  );
}

function CommentRow({
  comment,
  attemptId,
}: {
  comment: CommentView;
  attemptId: string;
}) {
  const remove = useRemoveComment(attemptId);
  const cheater = comment.authorStatus === "cheater";

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-2"
    >
      {/* The backend composes this string; render it, do not rewrite it. */}
      {comment.notice ? (
        <span className="font-pixel text-[8px] uppercase tracking-[0.12em] text-danger [text-shadow:var(--glow-danger)]">
          {comment.notice}
        </span>
      ) : null}

      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            "font-pixel text-[10px] uppercase tracking-[0.1em]",
            cheater ? "text-danger" : "text-cyan",
          )}
        >
          {comment.authorHandle}
        </span>
        <Label tone="faint">{formatAgo(comment.createdAt)}</Label>

        {comment.isMine ? (
          <button
            type="button"
            onClick={() => remove.mutate(comment.id)}
            disabled={remove.isPending}
            className="ml-auto font-body text-[10px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-danger disabled:opacity-40"
          >
            Delete
          </button>
        ) : null}
      </div>

      <Body size="sm" className="text-ink">
        {comment.body}
      </Body>
    </motion.li>
  );
}
