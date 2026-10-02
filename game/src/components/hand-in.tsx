"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ClockBar } from "./clock";
import { Icon } from "./icon";
import { Body, Button, Display, ErrorNote, Label, Rule } from "./ui";
import { errorMessages, type AssignmentView, type AttemptKind } from "@/lib/api";
import { useHandIn } from "@/lib/queries";
import { measureMedia } from "@/lib/hooks";
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
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MIN_VIDEO_SECONDS = 5;
const MAX_VIDEO_SECONDS = 120;
const VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];
const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"];

interface Measured {
  file: File;
  kind: AttemptKind;
  previewUrl: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

/** The same rules `checkMedia` applies server-side, so the answer matches. */
function reject(measured: Measured): string | null {
  const { file, kind, durationSeconds } = measured;

  if (kind === "photo") {
    if (!PHOTO_MIME.includes(file.type)) return "Photos must be JPEG, PNG or WebP.";
    if (file.size > MAX_PHOTO_BYTES) return "That photo is larger than 12 MB.";
    return null;
  }

  if (!VIDEO_MIME.includes(file.type)) return "Clips must be MP4, WebM or MOV.";
  if (file.size > MAX_VIDEO_BYTES) return "That clip is larger than 40 MB.";
  if (durationSeconds === undefined) return "Could not read that clip.";
  if (durationSeconds < MIN_VIDEO_SECONDS) return "Clips must run at least 5 seconds.";
  if (durationSeconds > MAX_VIDEO_SECONDS) return "Clips must be under 2 minutes.";
  return null;
}

export function HandInSheet({
  assignment,
  onClose,
}: {
  assignment: AssignmentView;
  onClose: () => void;
}) {
  const handIn = useHandIn();
  const inputRef = useRef<HTMLInputElement>(null);

  const [measured, setMeasured] = useState<Measured | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const proof = assignment.task.proof;
  const accept =
    proof === "photo"
      ? PHOTO_MIME.join(",")
      : proof === "video"
        ? VIDEO_MIME.join(",")
        : [...PHOTO_MIME, ...VIDEO_MIME].join(",");

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

    const kind: AttemptKind = file.type.startsWith("video/") ? "video" : "photo";
    const dimensions = await measureMedia(file);
    const next: Measured = {
      file,
      kind,
      previewUrl: URL.createObjectURL(file),
      ...dimensions,
    };

    const problem = reject(next);
    if (problem) {
      URL.revokeObjectURL(next.previewUrl);
      setLocalError(problem);
      setMeasured(null);
      return;
    }
    setMeasured(next);
  }

  const apiErrors = errorMessages(handIn.error);
  const busy = handIn.isPending;
  const done = handIn.stage === "done" && handIn.isSuccess;

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
            onClick={onClose}
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
            {/* picker / preview */}
            {!measured ? (
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
                    ? "JPEG, PNG or WebP · up to 12 MB"
                    : "5 s – 2 min · up to 40 MB"}
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
                disabled={!measured}
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
        <Label tone="faint">
          {formatBytes(measured.file.size)}
          {measured.durationSeconds ? ` · ${measured.durationSeconds}s` : ""}
          {measured.width ? ` · ${measured.width}×${measured.height}` : ""}
        </Label>
        <Button variant="quiet" size="sm" onClick={onReplace}>
          Replace
        </Button>
      </div>
    </div>
  );
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
