"use client";

/**
 * The reel: posts stacked full-screen, one per swipe.
 *
 * - **Snap scrolling** — one post per screen, never two halves.
 * - **One clip plays** — the slide at least 60% on screen is active; the
 *   rest are paused. Neighbours preload so a swipe never waits.
 * - **Endless** — the next page is fetched three posts before the end.
 * - **Addressable** — the URL follows the post on screen (`?v=<id>`), so
 *   reloading, sharing the address bar or going back lands on that post.
 * - **Comments** — a sheet over the reel on a phone; a panel docked beside
 *   it on desktop, where the frame slides over to make room.
 * - **Keys** — ↑/↓ or K/J between posts, M for sound.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CommentSheet } from "@/components/comment-sheet";
import { CommentThread } from "@/components/comments";
import { Icon } from "@/components/icon";
import type { FeedItem } from "@/lib/api";
import {
  setReelMuted,
  useChromeInsets,
  useIsDesktop,
  useReelMuted,
} from "@/lib/reel-state";
import { ReelSlide } from "./reel-slide";

const PANEL_WIDTH = 400;

export function Reel({
  items,
  hasMore,
  loadingMore,
  onLoadMore,
  startId,
  empty,
  topLeft,
}: {
  items: FeedItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Open on this post rather than the first. */
  startId?: string | null;
  /** What to show when there is nothing to scroll. */
  empty: ReactNode;
  /** A small control over the top-left of the reel (a back link). */
  topLeft?: ReactNode;
}) {
  const insets = useChromeInsets();
  const desktop = useIsDesktop();
  const muted = useReelMuted();
  const scroller = useRef<HTMLDivElement>(null);

  const [active, setActive] = useState(0);
  // Bumped on every change of active slide — see `ReelSlide.activation`.
  const [activation, setActivation] = useState(1);
  const [commentsFor, setCommentsFor] = useState<FeedItem | null>(null);

  /* ------------------------------------------- which slide is on screen */

  const activeRef = useRef(0);
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isNaN(index) || index === activeRef.current) continue;
          activeRef.current = index;
          setActive(index);
          setActivation((n) => n + 1);
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll<HTMLElement>("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  /* -------------------------------------------------- open on a post */

  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !startId || items.length === 0) return;
    const index = items.findIndex((i) => i.id === startId);
    if (index < 0) return;
    opened.current = true;
    scroller.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
  }, [startId, items]);

  /* ------------------------------------------------------ load more */

  useEffect(() => {
    if (hasMore && !loadingMore && active >= items.length - 3) onLoadMore();
  }, [active, items.length, hasMore, loadingMore, onLoadMore]);

  /* ------------------------------------------- the URL follows along */

  const current = items[active];
  useEffect(() => {
    if (!current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("v") === current.id) return;
    url.searchParams.set("v", current.id);
    window.history.replaceState(window.history.state, "", url);
  }, [current]);

  /* ------------------------------------------------------------ keys */

  const go = useCallback((delta: number) => {
    const root = scroller.current;
    if (!root) return;
    root.scrollBy({ top: delta * root.clientHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "m") {
        setReelMuted(!muted);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, muted]);

  /* -------------------------------------------------------- comments */

  // Keep the docked panel's post in step with the slide on screen: on
  // desktop the panel is "the comments for what you are watching".
  const panelItem =
    desktop && commentsFor ? (items.find((i) => i.id === current?.id) ?? commentsFor) : null;

  if (items.length === 0) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        {empty}
      </div>
    );
  }

  return (
    <>
      <div
        ref={scroller}
        className="fixed inset-0 snap-y snap-mandatory overflow-y-scroll overscroll-contain bg-void [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          right: panelItem ? PANEL_WIDTH : 0,
          transition: "right 0.3s cubic-bezier(0.16,1,0.3,1)",
        }}
        aria-label="Feed"
        role="feed"
        aria-busy={loadingMore}
      >
        {items.map((item, index) => (
          <div key={item.id} data-index={index} className="snap-start snap-always">
            <ReelSlide
              item={item}
              active={index === active}
              activation={index === active ? activation : 0}
              near={Math.abs(index - active) === 1}
              insets={insets}
              desktop={desktop}
              onComments={setCommentsFor}
            />
          </div>
        ))}

        {/* the end of the reel */}
        <div className="flex h-24 snap-end items-center justify-center">
          <span className="font-pixel text-[9px] uppercase tracking-[0.16em] text-ink-faint">
            {loadingMore ? "Loading more ▮" : hasMore ? "" : "That is all of it"}
          </span>
        </div>
      </div>

      {topLeft ? (
        <div className="fixed left-3 z-30" style={{ top: insets.top + 12 }}>
          {topLeft}
        </div>
      ) : null}

      {/* desktop: up / down, the way TikTok web does it */}
      {desktop ? (
        <div
          className="fixed z-30 flex -translate-y-1/2 flex-col gap-3"
          style={{ top: "50%", right: (panelItem ? PANEL_WIDTH : 0) + 24 }}
        >
          <NavButton label="Previous post" disabled={active === 0} onClick={() => go(-1)}>
            ▲
          </NavButton>
          <NavButton
            label="Next post"
            disabled={active >= items.length - 1 && !hasMore}
            onClick={() => go(1)}
          >
            ▼
          </NavButton>
        </div>
      ) : null}

      {/* comments */}
      <AnimatePresence>
        {panelItem ? (
          <motion.aside
            key="panel"
            initial={{ x: PANEL_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: PANEL_WIDTH }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-0 right-0 z-30 flex flex-col border-l border-blue-dim bg-surface"
            style={{ top: insets.top, width: PANEL_WIDTH }}
            aria-label={`Comments on ${panelItem.player.handle}'s post`}
          >
            <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="truncate font-pixel text-[11px] uppercase tracking-[0.1em] text-ink">
                  @{panelItem.player.handle}
                </span>
                {panelItem.task ? (
                  <span className="truncate font-body text-caption uppercase tracking-[0.12em] text-ink-faint">
                    {panelItem.task.title}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setCommentsFor(null)}
                aria-label="Close comments"
                className="-m-2 p-2 opacity-60 transition-opacity hover:opacity-100"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
              <CommentThread
                key={panelItem.id}
                attemptId={panelItem.id}
                count={panelItem.commentCount}
                returnTo={`/feed?v=${panelItem.id}`}
              />
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {!desktop && commentsFor ? (
        <CommentSheet
          item={items.find((i) => i.id === commentsFor.id) ?? commentsFor}
          onClose={() => setCommentsFor(null)}
        />
      ) : null}
    </>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center bg-surface-3 font-pixel text-[12px] text-ink frame-notch transition-all hover:bg-blue-deep hover:text-cyan disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  );
}
