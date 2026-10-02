"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ClockBar } from "./clock";
import { Icon } from "./icon";
import { Body, Button, Display, ErrorNote, Label, Rule } from "./ui";
import { errorMessages, type AssignmentView, type AttemptKind } from "@/lib/api";
import { useHandIn } from "@/lib/queries";
import { measureMedia } from "@/lib/hooks";
import {
  CompressionCanceled,
  preparePhoto,
  prepareVideo,
  ProbeRefusal,
} from "@/lib/compress";
import { formatBytes, formatPercent } from "@/lib/utils";

/**
 * Handing in proof.
 *
 * The constraint shaping this whole component: it is used on a phone, with
 * a clock running, by someone who has just done something slightly stupid
 * in public and wants it over with. So:
 *
 *   - **One screen, no steps.** The API has three round trips; the player
 *     sees one sheet. `useHandIn` reports which trip it is on.
 *   - **The file is checked before it is sent.** Duration and size are
 *     measured locally against the same limits the backend enforces, and a
 *     bad file is refused here rather than after a 40 MB upload. The server
 *     checks again — this is a courtesy, not the guard.
 *   - **Real progress.** `useHandIn` drives an XHR so the bar is the actual
 *     byte count. A fake spinner on a slow connection gets the tab closed.
 *   - **The clock stays visible.** It is the reason for everything here.
 */

/* The backend's own numbers, from `media-rules.ts`. Restated rather than
 * fetched because the hand-in sheet must be able to refuse a file while
 * offline, and these change on a deploy, not at runtime. */
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
export const MIN_VIDEO_SECONDS = 5;
export const MAX_VIDEO_SECONDS = 120;
const VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];
const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"];

interface Measured {
  file: File;
  kind: AttemptKind;
  previewUrl: string;
  /** What was picked, before shrinking; equal to `file.size` when untouched. */
  originalBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

/** The same rules `checkMedia` applies server-side, so the answer matches. */
function reject(measured: Measured): string | null {
  const { file, kind, durationSeconds } = measured;

  const shrunk = measured.originalBytes !== file.size;

  if (kind === "photo") {
    if (!PHOTO_MIME.includes(file.type)) return "Photos must be JPEG, PNG or WebP.";
    if (file.size > MAX_PHOTO_BYTES) {
      return shrunk
        ? "That photo is still over 12 MB after shrinking."
        : "That photo is larger than 12 MB, and this browser could not shrink it.";
    }
    return null;
  }

  if (!VIDEO_MIME.includes(file.type)) {
    return "This browser could not convert that clip. Record it as MP4 or MOV.";
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return shrunk
      ? "That clip is still over 40 MB after shrinking. Try a shorter one."
      : "That clip is over 40 MB, and this browser could not shrink it. Try a shorter one.";
  }
  if (durationSeconds === undefined) return "Could not read that clip.";
  if (durationSeconds < MIN_VIDEO_SECONDS) return "Clips must run at least 5 seconds.";
  if (durationSeconds > MAX_VIDEO_SECONDS) return "Clips must be under 2 minutes.";
  return null;
}

export function HandInSheet({
  assignment,
  onClose,
  onDone,
}: {
  assignment: AssignmentView;
  onClose: () => void;
  /** Fires once, when the confirm lands and the attempt is real. */
  onDone?: (assignment: AssignmentView) => void;
}) {
  const handIn = useHandIn();
  const inputRef = useRef<HTMLInputElement>(null);

  const [measured, setMeasured] = useState<Measured | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const proof = assignment.task.proof;
  // Any image or video the phone makes — HEIC, HEVC, 4K. It is converted
  // below into something the server takes, at a fraction of the size.
  const accept =
    proof === "photo" ? "image/*" : proof === "video" ? "video/*" : "image/*,video/*";

  // Shrinking in progress: how far, and from what size.
  const [shrinking, setShrinking] = useState<{ fraction: number; bytes: number; kind: AttemptKind } | null>(null);
  const shrinkAbort = useRef<AbortController | null>(null);
  useEffect(() => () => shrinkAbort.current?.abort(), []);

  // Revoke the object URL when the preview changes or the sheet closes.
  // Without this each retry leaks a whole video into memory, which on a
  // phone is how the tab gets killed mid-upload.
  useEffect(() => {
    const url = measured?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [measured?.previewUrl]);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setLocalError(null);

    // A new pick cancels a shrink still running for the last one.
    shrinkAbort.current?.abort();
    const abort = new AbortController();
    shrinkAbort.current = abort;

    const kind: AttemptKind = isVideo(file) ? "video" : "photo";
    setMeasured(null);
    setShrinking({ fraction: 0, bytes: file.size, kind });

    try {
      const prepared =
        kind === "video"
          ? await prepareVideo(file, {
              signal: abort.signal,
              onProgress: (fraction) =>
                setShrinking((s) => (s ? { ...s, fraction } : s)),
              // Too short or too long is refused before the slow part: no
              // point spending a minute encoding what the server will refuse.
              onProbe: ({ durationSeconds }) =>
                durationSeconds < MIN_VIDEO_SECONDS
                  ? "Clips must run at least 5 seconds."
                  : durationSeconds > MAX_VIDEO_SECONDS
                    ? "Clips must be under 2 minutes."
                    : null,
            })
          : await preparePhoto(file, abort.signal);

      // Measured off the final file, the way the server will see it. A
      // clip the encoder could not open is measured by the browser instead.
      const dimensions = await measureMedia(prepared.file);
      const next: Measured = {
        file: prepared.file,
        kind,
        previewUrl: URL.createObjectURL(prepared.file),
        originalBytes: prepared.originalBytes,
        width: dimensions.width ?? prepared.width,
        height: dimensions.height ?? prepared.height,
        durationSeconds: dimensions.durationSeconds ?? prepared.durationSeconds,
      };

      const problem = reject(next);
      if (problem) {
        URL.revokeObjectURL(next.previewUrl);
        setLocalError(problem);
        return;
      }
      setMeasured(next);
    } catch (error) {
      if (error instanceof CompressionCanceled) return;
      setLocalError(
        error instanceof ProbeRefusal ? error.message : "Could not read that file. Try another.",
      );
    } finally {
      if (shrinkAbort.current === abort) {
        shrinkAbort.current = null;
        setShrinking(null);
      }
    }
  }

  const apiErrors = errorMessages(handIn.error);
  const busy = handIn.isPending;
  const done = handIn.stage === "done" && handIn.isSuccess;

  // Told once, from an effect: the caller keeps the hand-in on screen after
  // the server stops returning it as the current assignment.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  // Once per hand-in, guarded by a ref. Keyed on `done` alone it re-fired
  // whenever the caller re-rendered this sheet with a new `assignment`
  // object — which the caller does *in* `onDone` — and looped until React
  // gave up ("Maximum update depth exceeded").
  const reported = useRef(false);
  useEffect(() => {
    if (!done || reported.current) return;
    reported.current = true;
    onDoneRef.current?.(assignment);
  }, [done, assignment]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-void/96 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Hand in proof"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex h-full w-full max-w-2xl flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6"
      >
        {/* header — the clock stays put while everything else scrolls */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <Label>Day {assignment.day}</Label>
            <Display size="sm">{assignment.task.title}</Display>
          </div>
          <button
            type="button"
            onClick={() => {
              shrinkAbort.current?.abort();
              onClose();
            }}
            disabled={busy}
            aria-label="Close"
            className="p-2 opacity-60 transition-opacity hover:opacity-100 disabled:opacity-20"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        <ClockBar
          expiresAt={assignment.expiresAt}
          totalSeconds={assignment.clockMinutes * 60}
        />

        <Rule />

        {done ? (
          <Done onClose={onClose} />
        ) : (
          <>
            {/* picker / shrinking / preview */}
            {shrinking ? (
              <Shrinking
                kind={shrinking.kind}
                fraction={shrinking.fraction}
                bytes={shrinking.bytes}
                onCancel={() => shrinkAbort.current?.abort()}
              />
            ) : !measured ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="group flex flex-col items-center gap-5 py-16 transition-opacity"
              >
                <Icon
                  name={proof === "photo" ? "camera" : "video"}
                  size="2xl"
                  className="opacity-40 transition-all duration-300 group-hover:opacity-100"
                />
                <span className="font-pixel text-[13px] uppercase tracking-[0.12em] text-ink-muted transition-all group-hover:text-cyan group-hover:[text-shadow:var(--glow-cyan)]">
                  {proof === "photo"
                    ? "Take a photo"
                    : proof === "video"
                      ? "Record a clip"
                      : "Photo or clip"}
                </span>
                <Label tone="faint">
                  {proof === "photo"
                    ? "Any photo · shrunk before it is sent"
                    : "5 s – 2 min · shrunk to 720p before it is sent"}
                </Label>
              </button>
            ) : (
              <Preview measured={measured} onReplace={() => inputRef.current?.click()} />
            )}

            <input
              ref={inputRef}
              type="file"
              accept={accept}
              // `capture` opens the camera directly on a phone rather than
              // the photo library. The task is happening now; a player
              // should not have to leave, record, come back and find a file.
              capture="environment"
              className="sr-only"
              onChange={(event) => void onPick(event.target.files?.[0])}
            />

            {/* caption */}
            {measured ? (
              <div className="flex flex-col gap-2">
                <Label tone="faint">Caption — optional</Label>
                <input
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  maxLength={280}
                  placeholder="SAY SOMETHING"
                  disabled={busy}
                  className="w-full border-b border-blue-dim bg-transparent pb-2.5 font-pixel text-[12px] uppercase tracking-[0.08em] text-ink outline-none transition-all placeholder:text-ink-faint/50 focus:border-cyan focus:[box-shadow:0_1px_0_0_rgb(1_231_255/0.6)]"
                />
              </div>
            ) : null}

            {localError ? <ErrorNote>{localError}</ErrorNote> : null}
            {apiErrors.length
              ? apiErrors.map((message) => (
                  <ErrorNote key={message}>{message}</ErrorNote>
                ))
              : null}

            {/* progress + send */}
            <div className="mt-auto flex flex-col gap-5 pt-6">
              {busy ? <Progress stage={handIn.stage} fraction={handIn.progress} /> : null}

              <Button
                size="lg"
                fullWidth
                disabled={!measured || shrinking !== null}
                loading={busy}
                onClick={() => {
                  if (!measured) return;
                  handIn.mutate({
                    assignmentId: assignment.id,
                    file: measured.file,
                    kind: measured.kind,
                    durationSeconds: measured.durationSeconds,
                    width: measured.width,
                    height: measured.height,
                    caption: caption.trim() || undefined,
                  });
                }}
              >
                Send it
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------- parts */

function Preview({
  measured,
  onReplace,
}: {
  measured: Measured;
  onReplace: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="scanlines relative overflow-hidden bg-surface">
        {measured.kind === "video" ? (
          <video
            src={measured.previewUrl}
            controls
            playsInline
            className="max-h-[46dvh] w-full object-contain"
          />
        ) : (
          // Deliberately not next/image: this is a local object URL for a
          // file that exists only in this tab. The optimizer cannot see it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={measured.previewUrl}
            alt="Your hand-in"
            className="max-h-[46dvh] w-full object-contain"
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          {measured.originalBytes !== measured.file.size ? (
            <span className="font-pixel text-[9px] uppercase tracking-[0.12em] text-good">
              Shrunk {formatBytes(measured.originalBytes)} → {formatBytes(measured.file.size)}
              {" · "}−
              {Math.max(1, Math.round((1 - measured.file.size / measured.originalBytes) * 100))}%
            </span>
          ) : null}
          <Label tone="faint">
            {formatBytes(measured.file.size)}
            {measured.durationSeconds ? ` · ${measured.durationSeconds}s` : ""}
            {measured.width ? ` · ${measured.width}×${measured.height}` : ""}
          </Label>
        </div>
        <Button variant="quiet" size="sm" onClick={onReplace}>
          Replace
        </Button>
      </div>
    </div>
  );
}

/**
 * The file is being made smaller before anything is sent: a real bar for a
 * clip (it can take a while on a phone), a blink for a photo (it cannot).
 */
function Shrinking({
  kind,
  fraction,
  bytes,
  onCancel,
}: {
  kind: AttemptKind;
  fraction: number;
  bytes: number;
  onCancel: () => void;
}) {
  const video = kind === "video";
  return (
    <div className="flex flex-col items-center gap-5 py-14 text-center">
      <Icon name={video ? "video" : "camera"} size="2xl" glow className="animate-pulse" />
      <span className="font-pixel text-[12px] uppercase tracking-[0.12em] text-cyan text-glow-cyan">
        {video ? "Shrinking your clip" : "Shrinking your photo"}
        {video ? ` ${formatPercent(fraction)}` : ""}
      </span>
      {video ? (
        <div className="relative h-0.5 w-full max-w-xs bg-blue-dim/40">
          <motion.div
            className="absolute inset-y-0 left-0 bg-cyan shadow-[var(--glow-cyan)]"
            animate={{ width: `${fraction * 100}%` }}
            transition={{ duration: 0.2, ease: "linear" }}
          />
        </div>
      ) : null}
      <Label tone="faint">
        {formatBytes(bytes)} → {video ? "720p MP4" : "web size"} · stays on your phone until you send it
      </Label>
      <Button variant="quiet" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

/** Some browsers leave `type` empty for a .mov; the extension decides then. */
function isVideo(file: File): boolean {
  if (file.type) return file.type.startsWith("video/");
  return /\.(mp4|mov|m4v|webm|3gp|mkv)$/i.test(file.name);
}

const STAGE_LABEL: Record<string, string> = {
  preparing: "Opening a slot",
  uploading: "Uploading",
  confirming: "Confirming",
  done: "Sent",
};

/**
 * Which of the three trips is happening, and how far the slow one has got.
 *
 * The bar only reflects the upload — the other two steps are a single
 * request each and pretending to measure them would be a lie that makes
 * the real number less trustworthy.
 */
function Progress({ stage, fraction }: { stage: string; fraction: number }) {
  const uploading = stage === "uploading";

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <Label>{STAGE_LABEL[stage] ?? "Working"}</Label>
        {uploading ? (
          <span className="font-pixel text-[10px] tabular-nums text-cyan text-glow-cyan-xs">
            {formatPercent(fraction)}
          </span>
        ) : null}
      </div>

      <div className="relative h-0.5 w-full bg-blue-dim/40">
        <motion.div
          className="absolute inset-y-0 left-0 bg-cyan shadow-[var(--glow-cyan)]"
          animate={{ width: uploading ? `${fraction * 100}%` : "100%" }}
          transition={{ duration: 0.2, ease: "linear" }}
          style={!uploading ? { opacity: 0.5 } : undefined}
        />
      </div>
    </div>
  );
}

function Done({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-1 flex-col items-center justify-center gap-7 text-center"
    >
      <Icon name="just-trophy" size="2xl" glow="lg" />
      <Display size="hero">Sent</Display>
      <Body size="sm" className="max-w-sm">
        It is with the watchers now. The window is open for a few hours and
        then it is judged.
      </Body>
      <Button size="lg" onClick={onClose}>
        Done
      </Button>
    </motion.div>
  );
}
