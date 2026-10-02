"use client";

/**
 * Comments, over the feed.
 *
 * Opening a post's own page to say one thing loses the reader's place in a
 * long scroll. This slides up from the bottom instead — the thread and a
 * composer ready to type in — and closes back to exactly where they were.
 * Escape, the backdrop and the close button all dismiss it; while it is
 * open the page behind does not scroll.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect } from "react";
import { CommentThread } from "@/components/comments";
import { Icon } from "@/components/icon";
import type { FeedItem } from "@/lib/api";

export function CommentSheet({ item, onClose }: { item: FeedItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Comments on ${item.player.handle}'s hand-in`}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex max-h-[82dvh] w-full max-w-xl flex-col border-t border-blue-dim bg-surface shadow-[0_-12px_60px_rgb(1_163_255/0.15)] sm:border"
      >
        {/* the grab bar and the header stay put; the thread scrolls */}
        <div className="flex flex-col gap-4 px-4 pb-4 pt-3 sm:px-6">
          <span aria-hidden className="mx-auto h-1 w-10 bg-blue-dim sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="truncate font-pixel text-[11px] uppercase tracking-[0.1em] text-ink">
                {item.player.handle}
              </span>
              {item.task ? (
                <span className="truncate font-body text-caption uppercase tracking-[0.12em] text-ink-faint">
                  {item.task.title}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close comments"
              className="-m-2 p-2 opacity-60 transition-opacity hover:opacity-100"
            >
              <Icon name="close" size="sm" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 pb-8 sm:px-6">
          <CommentThread
            attemptId={item.id}
            count={item.commentCount}
            returnTo={`/feed/${item.id}`}
            autoFocus
          />
          <Link
            href={`/feed/${item.id}`}
            className="mt-8 inline-flex items-center gap-2 font-pixel text-[9px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-cyan"
          >
            Open the post ▶
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
