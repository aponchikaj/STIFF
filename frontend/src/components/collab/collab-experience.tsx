"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, collabApi } from "@/lib/api";
import { AsteriskMark } from "@/components/asterisk-mark";
import { usePrivatePlayback } from "./use-private-playback";

type View =
  | { status: "loading" }
  | { status: "gate"; token: string }
  | { status: "opening" }
  | {
      status: "watch";
      serial: string;
      title: string;
      url: string;
      mode: "signed" | "proxy";
      strictMode: boolean;
    }
  | { status: "used" }
  | { status: "notlive" }
  | { status: "denied" };

function takePendingToken(): string | null {
  try {
    const token = sessionStorage.getItem(collabApi.COLLAB_PENDING_KEY);
    return token && token.length >= 16 ? token : null;
  } catch {
    return null;
  }
}

function clearPendingToken(): void {
  try {
    sessionStorage.removeItem(collabApi.COLLAB_PENDING_KEY);
  } catch {
    // storage blocked
  }
}

export function CollabExperience({
  initialToken,
}: {
  initialToken?: string;
}) {
  const [view, setView] = useState<View>({ status: "loading" });
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const strict =
    view.status === "watch" ? view.strictMode : initialToken ? false : true;
  const veiled = usePrivatePlayback(videoRef, view.status === "watch" && strict);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.disableRemotePlayback = true;
    video.setAttribute("referrerpolicy", "no-referrer");
  }, [view]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const token = initialToken ?? takePendingToken();
      try {
        const session = await collabApi.getSession();
        if (ignore) return;
        if (token && session.strictMode) {
          try {
            await collabApi.redeem(token);
          } catch (err) {
            if (err instanceof ApiError && err.status === 410) {
              clearPendingToken();
              setView({ status: "used" });
              return;
            }
          }
        }
        if (!session.hasVideo) {
          setView({ status: "notlive" });
          return;
        }
        const play = await collabApi.getPlayback();
        if (ignore) return;
        setView({
          status: "watch",
          serial: play.serial,
          title: play.title,
          url: collabApi.playbackSrc(play),
          mode: play.mode,
          strictMode: play.strictMode,
        });
      } catch {
        if (ignore) return;
        if (token) setView({ status: "gate", token });
        else setView({ status: "denied" });
      }
    })();
    return () => {
      ignore = true;
    };
  }, [initialToken]);

  const openPair = useCallback(async (token: string) => {
    setView({ status: "opening" });
    try {
      await collabApi.redeem(token);
      clearPendingToken();
      const play = await collabApi.getPlayback();
      setView({
        status: "watch",
        serial: play.serial,
        title: play.title,
        url: collabApi.playbackSrc(play),
        mode: play.mode,
        strictMode: play.strictMode,
      });
    } catch (err) {
      clearPendingToken();
      if (err instanceof ApiError) {
        if (err.status === 410) {
          setView({ status: "used" });
          return;
        }
        if (err.status === 503) {
          setView({ status: "notlive" });
          return;
        }
      }
      setView({ status: "denied" });
    }
  }, []);

  useEffect(() => {
    if (view.status !== "watch" || view.mode !== "signed") return;
    const id = window.setInterval(() => {
      const video = videoRef.current;
      const time = video?.currentTime ?? 0;
      const wasPaused = video?.paused ?? true;
      void collabApi.getPlayback().then((play) => {
        const next = collabApi.playbackSrc(play);
        const el = videoRef.current;
        if (!el) return;
        el.src = next;
        const resume = () => {
          el.currentTime = time;
          if (!wasPaused) void el.play().catch(() => undefined);
          el.removeEventListener("loadedmetadata", resume);
        };
        el.addEventListener("loadedmetadata", resume);
      });
    }, 45_000);
    return () => window.clearInterval(id);
  }, [view]);

  if (view.status === "loading" || view.status === "opening") {
    return (
      <Room>
        <AsteriskMark className="size-8 animate-asterisk-tick text-white/40" />
        <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.35em] text-white/50">
          {view.status === "opening" ? "Opening" : "Private"}
        </p>
      </Room>
    );
  }

  if (view.status === "denied") {
    return (
      <Room>
        <Denied />
      </Room>
    );
  }

  if (view.status === "used") {
    return (
      <Room>
        <p className="font-display text-4xl uppercase tracking-tight sm:text-6xl">
          Opened
        </p>
        <p className="mt-6 max-w-sm text-sm leading-6 text-white/55">
          This pair has already been opened. The film cannot be shared, resent,
          or scanned again.
        </p>
      </Room>
    );
  }

  if (view.status === "notlive") {
    return (
      <Room>
        <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/50">
          STIFF × KEBURIA
        </p>
        <p className="mt-6 font-display text-4xl uppercase tracking-tight sm:text-6xl">
          Not yet
        </p>
        <p className="mt-6 max-w-sm text-sm leading-6 text-white/55">
          The film is not live. Your code was not used. Scan again when the
          drop opens.
        </p>
      </Room>
    );
  }

  if (view.status === "gate") {
    return (
      <Room>
        <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/50">
          STIFF × KEBURIA
        </p>
        <h1 className="mt-6 font-display text-5xl uppercase tracking-tight sm:text-7xl">
          Private
        </h1>
        <p className="mt-6 max-w-xs text-sm leading-6 text-white/55">
          {initialToken
            ? "Scan accepted. Play the film on this screen."
            : "One scan. This device only. The film cannot be shared, saved, or opened twice."}
        </p>
        <button
          type="button"
          onClick={() => void openPair(view.token)}
          className="mt-12 flex h-12 min-w-[12rem] items-center justify-center rounded-[2px] bg-white px-8 text-xs font-bold uppercase tracking-[0.2em] text-black transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Open this pair
        </button>
      </Room>
    );
  }

  return (
    <div
      className="collab-room relative flex min-h-dvh flex-col bg-black text-white"
      onContextMenu={
        view.strictMode ? (event) => event.preventDefault() : undefined
      }
    >
      <video
        ref={videoRef}
        src={view.url}
        playsInline
        disablePictureInPicture={view.strictMode}
        controls={!view.strictMode}
        controlsList={
          view.strictMode
            ? "nodownload nofullscreen noremoteplayback noplaybackrate"
            : "nodownload"
        }
        crossOrigin={view.mode === "proxy" ? "use-credentials" : undefined}
        preload="auto"
        className="absolute inset-0 h-full w-full bg-black object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      {view.strictMode && (
        <div
          aria-hidden="true"
          className="collab-watermark pointer-events-none absolute inset-0"
        >
          <span className="collab-watermark-a">
            {view.title} · {view.serial}
          </span>
          <span className="collab-watermark-b">{view.serial} · private</span>
        </div>
      )}
      {view.strictMode && !playing && !veiled && (
        <button
          type="button"
          onClick={() => void videoRef.current?.play()}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-black/40"
        >
          <span className="flex size-16 items-center justify-center rounded-full border border-white/40">
            <span className="ml-1 h-0 w-0 border-y-8 border-y-transparent border-l-[14px] border-l-white" />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/80">
            Play
          </span>
        </button>
      )}
      {veiled && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/40">
            Private
          </p>
        </div>
      )}
    </div>
  );
}

function Room({ children }: { children: React.ReactNode }) {
  return (
    <div className="collab-room flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      {children}
    </div>
  );
}

function Denied() {
  return (
    <>
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="font-display text-7xl leading-none tracking-tight sm:text-9xl">
          4
        </span>
        <AsteriskMark className="size-14 sm:size-24" />
        <span className="font-display text-7xl leading-none tracking-tight sm:text-9xl">
          4
        </span>
      </div>
      <p className="mt-6 text-sm font-medium uppercase tracking-[0.35em] text-white/45">
        Page not found
      </p>
      <Link
        href="/"
        className="mt-8 flex h-11 items-center rounded-[2px] bg-white px-6 text-xs font-bold uppercase tracking-[0.2em] text-black transition-opacity hover:opacity-80"
      >
        Back home
      </Link>
    </>
  );
}
