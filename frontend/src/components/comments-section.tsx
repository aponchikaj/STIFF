"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { commentsApi } from "@/lib/api";
import type { Comment, TargetType } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { useSession } from "./providers";
import {
  btnGhostSm,
  btnSolidSm,
  ErrorNote,
  Loading,
  textareaCls,
} from "./ui";

export function CommentsSection({
  targetType,
  targetId,
}: {
  targetType: TargetType;
  targetId: string;
}) {
  const { user } = useSession();
  const pathname = usePathname();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(
    () => commentsApi.listComments(targetType, targetId, { page, pageSize: 10 }),
    [targetType, targetId, page],
  );
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function post(text: string, parentId?: string): Promise<boolean> {
    setBusy(true);
    setNote(null);
    try {
      await commentsApi.createComment({
        targetType,
        targetId,
        body: text,
        parentId,
      });
      reload();
      return true;
    } catch (err) {
      setNote(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 10));

  return (
    <div>
      <h2 className="text-2xl uppercase tracking-tight sm:text-4xl">
        Comments{" "}
        <span className="text-muted">{total > 0 ? `(${total})` : ""}</span>
      </h2>

      {user ? (
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!body.trim()) return;
            if (await post(body.trim())) setBody("");
          }}
        >
          <label htmlFor={`comment-${targetId}`} className="sr-only">
            Write a comment
          </label>
          <textarea
            id={`comment-${targetId}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Say something"
            className={textareaCls}
          />
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className={btnSolidSm}
            >
              Post
            </button>
            <p aria-live="polite" className="text-xs text-muted">
              {note}
            </p>
          </div>
        </form>
      ) : (
        <p className="mt-6 text-sm text-muted">
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="rounded-[2px] font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            Log in
          </Link>{" "}
          to join the conversation.
        </p>
      )}

      <div className="mt-8">
        {loading && <Loading label="Loading comments" />}
        {error && <ErrorNote message={error} />}
        {data && data.items.length === 0 && (
          <p className="py-8 text-sm text-muted">
            No comments yet. Be the first.
          </p>
        )}
        <ul className="flex flex-col">
          {data?.items.map((comment) => (
            <li key={comment.id} className="border-t border-subtle py-6">
              <CommentItem
                comment={comment}
                onReply={post}
                onChanged={reload}
              />
            </li>
          ))}
        </ul>
        {pageCount > 1 && (
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className={btnGhostSm}
            >
              ← Newer
            </button>
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              className={btnGhostSm}
            >
              Older →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  onReply,
  onChanged,
  isReply = false,
}: {
  comment: Comment;
  onReply: (text: string, parentId: string) => Promise<boolean>;
  onChanged: () => void;
  isReply?: boolean;
}) {
  const { user } = useSession();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [replyDraft, setReplyDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const own = user?.id === comment.user.id;
  const canDelete = own || user?.role === "admin";

  async function saveEdit() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await commentsApi.updateComment(comment.id, draft.trim());
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await commentsApi.deleteComment(comment.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-xs font-bold uppercase tracking-wide">
          {comment.user.username}
        </p>
        {comment.verifiedBuyer && (
          // Changes how the whole thread reads: an opinion from someone who
          // owns the piece is a different kind of statement.
          <span
            title="Bought this piece"
            className="rounded-[2px] border border-foreground px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em]"
          >
            Bought it
          </span>
        )}
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
          {formatDate(comment.createdAt)}
        </p>
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            maxLength={1000}
            className={textareaCls}
          />
          <div className="flex gap-4">
            <button
              type="button"
              onClick={saveEdit}
              disabled={busy}
              className={btnGhostSm}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(comment.body);
              }}
              className={btnGhostSm}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6">{comment.body}</p>
      )}

      <div className="mt-2 flex gap-4">
        {user && !isReply && (
          <button
            type="button"
            onClick={() => setReplying((r) => !r)}
            className={btnGhostSm}
          >
            Reply
          </button>
        )}
        {own && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={btnGhostSm}
          >
            Edit
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className={btnGhostSm}
          >
            Delete
          </button>
        )}
      </div>

      {replying && (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!replyDraft.trim()) return;
            if (await onReply(replyDraft.trim(), comment.id)) {
              setReplyDraft("");
              setReplying(false);
            }
          }}
        >
          <textarea
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={`Reply to ${comment.user.username}`}
            className={textareaCls}
          />
          <button type="submit" className={`${btnSolidSm} self-start`}>
            Reply
          </button>
        </form>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <ul className="mt-4 flex flex-col gap-4 border-l border-subtle pl-4 sm:pl-6">
          {comment.replies.map((reply) => (
            <li key={reply.id}>
              <CommentItem
                comment={reply}
                onReply={onReply}
                onChanged={onChanged}
                isReply
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
