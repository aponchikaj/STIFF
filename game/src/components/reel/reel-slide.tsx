"use client";

/**
 * One post in the reel: a full-screen clip with everything laid over it.
 *
 * Phone: the media is edge to edge, the caption and the task sit bottom
 * left over a fade, and the actions stack on the right — the layout people
 * already know how to read without thinking. Desktop: the media is framed
 * in the middle at its own shape, the rail stands beside it.
 *
 * Touch:
 *   tap         pause / play
 *   double-tap  like, with a heart where the thumb was (never unlikes)
 *
 * Playback is driven by `active` from the reel: only the clip on screen
 * plays; the rest are paused and rewound, so coming back starts it over.
 */

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FeedTaskDetails } from "@/components/feed-task";
import { Icon } from "@/components/icon";
import type { FeedItem, SeasonDay } from "@/lib/api";
import { useAuthState, useRecordShare, useToggleLike } from "@/lib/queries";
import { setReelMuted, useReelMuted, type ChromeInsets } from "@/lib/reel-state";
import { cn, formatAgo, formatCompact } from "@/lib/utils";

const OPAL: Record<SeasonDay, string> = { 1: "001", 2: "002", 3: "003" };
const DOUBLE_TAP_MS = 280;

export function ReelSlide({
  item,
  active,
  activation,
  near,
  insets,
  desktop,
  onComments,
}: {
  item: FeedItem;
  /** On screen now: plays. */
  active: boolean;
  /** Bumped each time this slide becomes active — a pause is per visit. */
  activation: number;
  /** Next to the active slide: worth preloading. */
  near: boolean;
  insets: ChromeInsets;
  desktop: boolean;
  onComments: (item: FeedItem) => void;
}) {
  const router = useRouter();
  const { isSignedIn } = useAuthState();
  const like = useToggleLike();
  const muted = useReelMuted();

  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  // Paused by the viewer *on this visit*: a token, so leaving and coming
  // back plays again without resetting state from an effect.
  const [pausedOn, setPausedOn] = useState<number | null>(null);
  const paused = pausedOn === activation;
  const [blocked, setBlocked] = useState(false);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const isVideo = item.kind === "video" && Boolean(item.mediaUrl);
  const portrait =
    item.width && item.height ? item.height >= item.width * 1.1 : item.kind === "video";
  const cheater = item.player.status === "cheater";

  /* ---------------------------------------------------------- playback */

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (active && !paused) {
      v.muted = muted;
      v.play().then(
        () => setBlocked(false),
        // Autoplay refused (low-power mode, a strict browser): show a play
        // button rather than a frozen first frame that looks broken.
        () => setBlocked(true),
      );
    } else {
      v.pause();
      if (!active) v.currentTime = 0;
    }
    // `muted` is applied by its own effect; replaying on a mute toggle
    // would restart nothing but would re-run play() needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused]);

  // The progress bar, written straight to the DOM each frame while playing
  // — sixty React renders a second for a 2px line would be the slowest
  // thing on the screen.
  useEffect(() => {
    if (!active || !isVideo) return;
    let raf = 0;
    const step = () => {
      const v = video.current;
      if (v && bar.current && v.duration > 0) {
        bar.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, isVideo]);

  /* -------------------------------------------------------------- taps */

  const lastTap = useRef(-Infinity);
  const heartId = useRef(0);
  const tapTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(tapTimer.current), []);

  function onTap(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // The event's own clock: two taps are compared with each other, so
    // milliseconds since the page loaded are as good as wall time.
    const now = event.timeStamp;

    if (now - lastTap.current < DOUBLE_TAP_MS) {
      window.clearTimeout(tapTimer.current);
      lastTap.current = -Infinity;
      burst(x, y);
      return;
    }
    lastTap.current = now;
    tapTimer.current = window.setTimeout(() => {
      if (blocked) {
        setBlocked(false);
        void video.current?.play().catch(() => setBlocked(true));
        return;
      }
      setPausedOn(paused ? null : activation);
    }, DOUBLE_TAP_MS);
  }

  function burst(x: number, y: number) {
    if (!isSignedIn) {
      router.push(`/login?next=${encodeURIComponent(`/feed?v=${item.id}`)}`);
      return;
    }
    heartId.current += 1;
    const id = heartId.current;
    setHearts((h) => [...h, { id, x, y }]);
    // Double-tap likes; it never unlikes. That is what the rail is for.
    if (!item.likedByMe) like.mutate(item.id);
  }

  function toggleLike() {
    if (!isSignedIn) {
      router.push(`/login?next=${encodeURIComponent(`/feed?v=${item.id}`)}`);
      return;
    }
    like.mutate(item.id);
  }

  /* ------------------------------------------------------------- media */

  const media = item.mediaUrl ? (
    isVideo ? (
      <video
        ref={video}
        src={item.mediaUrl}
        muted
        loop
        playsInline
        preload={active || near ? "auto" : "none"}
        className={cn(
          "absolute inset-0 size-full",
          portrait && !desktop ? "object-cover" : "object-contain",
        )}
      />
    ) : (
      // User media on an unknown host; next/image would need every bucket
      // whitelisted and buys nothing here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.mediaUrl}
        alt={item.caption ?? `Hand-in by ${item.player.handle}`}
        loading={active || near ? "eager" : "lazy"}
        className={cn(
          "absolute inset-0 size-full",
          portrait && !desktop ? "object-cover" : "object-contain",
        )}
      />
    )
  ) : (
    <div className="absolute inset-0 flex items-center justify-center">
      <Icon name="warning" size="lg" className="opacity-30" />
    </div>
  );

  /* -------------------------------------------------------------- layout */

  const info = (
    <div className="pointer-events-auto flex max-w-[calc(100%-84px)] flex-col gap-2.5 md:max-w-none">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={`/u/${encodeURIComponent(item.player.handle)}`}
          className={cn(
            "font-pixel text-[12px] uppercase tracking-[0.08em] [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]",
            cheater ? "text-danger" : "text-ink hover:text-cyan",
          )}
        >
          @{item.player.handle}
        </Link>
        {cheater ? (
          <span className="font-pixel text-[8px] uppercase tracking-[0.1em] text-danger">
            Cheater
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Icon name="star" size="xs" glow />
            <span className="font-pixel text-[9px] tabular-nums text-cyan text-glow-cyan-xs">
              {formatCompact(item.player.nerve)}
            </span>
          </span>
        )}
        <span className="font-body text-[11px] text-ink-muted [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">
          {formatAgo(item.publishedAt)}
        </span>
      </div>

      {item.caption ? (
        <button
          type="button"
          onClick={() => setCaptionOpen((v) => !v)}
          className={cn(
            "text-left font-body text-[14px] leading-[19px] text-ink [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]",
            !captionOpen && "line-clamp-2",
          )}
        >
          {item.caption}
        </button>
      ) : null}

      {item.task ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setTaskOpen((v) => !v)}
            aria-expanded={taskOpen}
            className="group inline-flex max-w-full items-center gap-2 self-start bg-void/55 px-2.5 py-1.5 backdrop-blur-sm frame-notch"
          >
            <Icon name="opal" size="xs" glow />
            <span className="truncate font-pixel text-[9px] uppercase tracking-[0.1em] text-cyan">
              {OPAL[item.day]} · {item.task.title}
            </span>
            <span
              aria-hidden
              className={cn(
                "font-pixel text-[8px] text-ink-muted transition-transform",
                taskOpen && "rotate-90",
              )}
            >
              ▶
            </span>
          </button>
          <AnimatePresence initial={false}>
            {taskOpen ? (
              <motion.div
                key="task"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
                className="max-h-[38vh] overflow-y-auto bg-void/75 p-3 backdrop-blur-md frame-notch"
              >
                <FeedTaskDetails task={item.task} defaultOpen />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );

  const rail = (
    <div className="pointer-events-auto flex flex-col items-center gap-3.5">
      <Link
        href={`/u/${encodeURIComponent(item.player.handle)}`}
        aria-label={`${item.player.handle}'s profile`}
        className="group relative mb-1"
      >
        <Avatar handle={item.player.handle} cheater={cheater} />
      </Link>

      <RailButton
        label={item.likedByMe ? "Unlike" : "Like"}
        pressed={item.likedByMe ?? false}
        count={item.likeCount}
        onClick={toggleLike}
      >
        <Icon
          name={item.likedByMe ? "filled-heart" : "outline-heart"}
          size="lg"
          glow={item.likedByMe ? "heart" : undefined}
        />
      </RailButton>

      <RailButton
        label={`Comments (${item.commentCount})`}
        count={item.commentCount}
        onClick={() => onComments(item)}
      >
        <Icon name="chat" size="lg" />
      </RailButton>

      <ShareButton item={item} />

      {/* The spinning record, made an opal: back to the game. */}
      <Link href="/play" aria-label="Play the game" className="mt-1">
        <motion.span
          className="block"
          animate={active && !paused ? { rotate: 360 } : { rotate: 0 }}
          transition={
            active && !paused
              ? { duration: 6, repeat: Infinity, ease: "linear" }
              : { duration: 0.3 }
          }
        >
          <Icon name="opal" size="lg" glow />
        </motion.span>
      </Link>
    </div>
  );

  const overlays = (
    <>
      {/* tap layer: pause, double-tap like */}
      <div className="absolute inset-0" onClick={onTap} aria-hidden />

      {/* paused / blocked */}
      <AnimatePresence>
        {isVideo && (paused || blocked) ? (
          <motion.span
            key="paused"
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 0.9, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-pixel text-[56px] text-ink [text-shadow:var(--glow-cyan-lg)]"
          >
            ▶
          </motion.span>
        ) : null}
      </AnimatePresence>

      {/* hearts from double-taps */}
      {hearts.map((h) => (
        <motion.span
          key={h.id}
          className="pointer-events-none absolute"
          style={{ left: h.x - 40, top: h.y - 40 }}
          initial={{ opacity: 0, scale: 0.3, rotate: -14 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.25, 1, 1.4], y: [0, 0, -10, -70] }}
          transition={{ duration: 0.9, times: [0, 0.2, 0.55, 1] }}
          onAnimationComplete={() => setHearts((all) => all.filter((x) => x.id !== h.id))}
        >
          <Icon name="filled-heart" size={80} glow="heart" />
        </motion.span>
      ))}

      {/* sound */}
      {isVideo ? (
        <button
          type="button"
          onClick={() => setReelMuted(!muted)}
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={!muted}
          className="absolute right-3 z-10 flex size-10 items-center justify-center bg-void/45 backdrop-blur-sm frame-notch"
          style={{ top: desktop ? 12 : insets.top + 12 }}
        >
          <Speaker muted={muted} />
        </button>
      ) : null}

      {/* progress */}
      {isVideo ? (
        <div
          className="absolute inset-x-0 h-0.5 bg-ink/15"
          style={{ bottom: desktop ? 0 : insets.bottom }}
        >
          <div
            ref={bar}
            className="h-full origin-left bg-cyan shadow-[var(--glow-cyan-sm)]"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      ) : null}
    </>
  );

  if (desktop) {
    const ratio = item.width && item.height ? item.width / item.height : 9 / 16;
    return (
      <section
        data-reel-id={item.id}
        aria-label={`Post by ${item.player.handle}`}
        className="relative flex h-dvh w-full items-center justify-center gap-6"
        style={{ paddingTop: insets.top + 20, paddingBottom: 20 }}
      >
        <div
          className="relative h-full max-w-[min(56vw,720px)] overflow-hidden bg-surface scanlines"
          style={{ aspectRatio: String(ratio) }}
        >
          {media}
          {overlays}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-void/90 via-void/40 to-transparent px-4 pb-5 pt-24">
            {info}
          </div>
        </div>
        <div className="flex h-full flex-col justify-end pb-2">{rail}</div>
      </section>
    );
  }

  return (
    <section
      data-reel-id={item.id}
      aria-label={`Post by ${item.player.handle}`}
      className="relative h-dvh w-full overflow-hidden bg-void"
    >
      {media}
      {overlays}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-void/90 via-void/45 to-transparent px-4 pt-32"
        style={{ paddingBottom: insets.bottom + 18 }}
      >
        {info}
      </div>
      <div
        className="pointer-events-none absolute right-2.5"
        style={{ bottom: insets.bottom + 18 }}
      >
        {rail}
      </div>
    </section>
  );
}

/* ================================================================ parts */

function RailButton({
  label,
  pressed,
  count,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="group flex flex-col items-center gap-1.5"
    >
      <motion.span
        whileTap={{ scale: 0.8 }}
        transition={{ duration: 0.1 }}
        className="flex size-14 items-center justify-center [filter:drop-shadow(0_1px_4px_rgb(0_0_0/0.8))]"
      >
        {children}
      </motion.span>
      <span className="font-pixel text-[10px] tabular-nums text-ink [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">
        {formatCompact(count)}
      </span>
    </button>
  );
}

/** The player's mark: their initial on a notched, lit plate. No photo exists. */
function Avatar({ handle, cheater }: { handle: string; cheater: boolean }) {
  return (
    <span className={cn("block", cheater ? "bloom-danger" : "bloom-cyan")}>
      <span
        className={cn(
          "flex size-12 items-center justify-center font-pixel text-[18px] uppercase frame-notch transition-colors",
          cheater ? "bg-heart-dim text-ink" : "bg-blue-deep text-ink group-hover:bg-blue",
        )}
      >
        {handle.slice(0, 1)}
      </span>
    </span>
  );
}

/** A pixel speaker, crisp at any size. */
function Speaker({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={20}
      height={20}
      shapeRendering="crispEdges"
      aria-hidden
      className="text-ink [filter:drop-shadow(0_0_3px_rgb(1_231_255/0.7))]"
    >
      <rect x="2" y="6" width="3" height="4" fill="currentColor" />
      <rect x="5" y="5" width="1" height="6" fill="currentColor" />
      <rect x="6" y="4" width="1" height="8" fill="currentColor" />
      <rect x="7" y="3" width="1" height="10" fill="currentColor" />
      {muted ? (
        <g fill="#ff4d5e">
          <rect x="10" y="5" width="1" height="1" />
          <rect x="11" y="6" width="1" height="1" />
          <rect x="12" y="7" width="1" height="2" />
          <rect x="11" y="9" width="1" height="1" />
          <rect x="10" y="10" width="1" height="1" />
          <rect x="13" y="6" width="1" height="1" />
          <rect x="14" y="5" width="1" height="1" />
          <rect x="13" y="9" width="1" height="1" />
          <rect x="14" y="10" width="1" height="1" />
        </g>
      ) : (
        <g fill="currentColor">
          <rect x="10" y="6" width="1" height="4" />
          <rect x="12" y="4" width="1" height="8" />
          <rect x="14" y="2" width="1" height="12" />
        </g>
      )}
    </svg>
  );
}

/**
 * Share: the OS sheet on a phone (the only road into Instagram Stories),
 * copy the link elsewhere. A cancelled sheet is not counted.
 */
function ShareButton({ item }: { item: FeedItem }) {
  const record = useRecordShare();
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "STIFF", url: item.shareUrl });
      } else {
        await navigator.clipboard.writeText(item.shareUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      return;
    }
    record.mutate(item.id);
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      aria-label="Share"
      className="group flex flex-col items-center gap-1.5"
    >
      <motion.span
        whileTap={{ scale: 0.8 }}
        transition={{ duration: 0.1 }}
        className="flex size-14 items-center justify-center [filter:drop-shadow(0_1px_4px_rgb(0_0_0/0.8))]"
      >
        <Icon name="send" size="lg" />
      </motion.span>
      <span className="font-pixel text-[10px] tabular-nums text-ink [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">
        {copied ? "Copied" : formatCompact(item.shareCount)}
      </span>
    </button>
  );
}
