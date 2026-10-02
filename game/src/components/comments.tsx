"use client";

/**
 * A hand-in's comment thread: the composer, then what has been said.
 *
 * One implementation, used by the post page and by the sheet that opens over
 * the feed, so the cheater notice, the delete rule and the sign-in nudge
 * behave the same everywhere a comment can be read or written.
 *
 * The cheater notice is the backend's string, rendered as-is: once an
 * account is marked a cheater every comment it ever left says so, read at
 * render time, never rewritten here.
 */

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Body, Button, ErrorNote, Label, Loading } from "@/components/ui";
import type { ApiError, CommentView } from "@/lib/api";
import {
  useAddComment,
  useAuthState,
  useComments,
  useRemoveComment,
} from "@/lib/queries";
import { cn, formatAgo } from "@/lib/utils";

export function CommentThread({
  attemptId,
  count,
  /** Where sign-in returns to. */
  returnTo,
  autoFocus = false,
}: {
  attemptId: string;
  count: number;
  returnTo: string;
  autoFocus?: boolean;
}) {
  const comments = useComments(attemptId);

  return (
    <section className="flex flex-col gap-6">
      <Label>{count === 1 ? "1 comment" : `${count} comments`}</Label>

      <CommentComposer attemptId={attemptId} returnTo={returnTo} autoFocus={autoFocus} />

      {comments.isLoading ? (
        <Loading label="READING" />
      ) : (comments.data?.length ?? 0) === 0 ? (
        <Body size="sm" className="py-4 text-ink-faint">
          Nothing said yet. Be the first.
        </Body>
      ) : (
        <ul className="flex flex-col gap-6">
          {comments.data?.map((comment) => (
            <CommentRow key={comment.id} comment={comment} attemptId={attemptId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CommentComposer({
  attemptId,
  returnTo,
  autoFocus,
}: {
  attemptId: string;
  returnTo: string;
  autoFocus: boolean;
}) {
  const router = useRouter();
  const { isSignedIn } = useAuthState();
  const add = useAddComment(attemptId);
  const [body, setBody] = useState("");

  if (!isSignedIn) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/login?next=${encodeURIComponent(returnTo)}`)}
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
          autoFocus={autoFocus}
          aria-label="Your comment"
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

      <Body size="sm" className="break-words text-ink">
        {comment.body}
      </Body>
    </motion.li>
  );
}
