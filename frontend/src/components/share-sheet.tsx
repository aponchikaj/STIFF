"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  renderShareImage,
  shareFileName,
  SHARE_TEMPLATES,
  type ShareSubject,
  type ShareTemplateId,
} from "@/lib/share-image";
import { btnOutline, btnSolidSm, Spinner } from "./ui";

/**
 * Share dialog for a gallery shot.
 *
 * Instagram and Facebook have no web API for posting to Stories — the only
 * routes from a browser are the OS share sheet (which lists both apps) or the
 * camera roll. So the branded image is generated here and then handed off:
 * `navigator.share` with the file on mobile, a download everywhere else.
 * Link-only targets (Facebook feed, X) fall back to their web intents, which
 * pull the page's Open Graph card.
 */

type CanShareFiles = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
};

function canShareFiles(file: File): boolean {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  const nav = navigator as CanShareFiles;
  return Boolean(nav.canShare?.({ files: [file] }));
}

export function ShareSheet({
  subject,
  onClose,
}: {
  subject: ShareSubject;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState<ShareTemplateId>("frame");
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [building, setBuilding] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Re-render whenever the chosen design changes. The object URL is revoked on
  // cleanup so switching designs repeatedly doesn't leak.
  useEffect(() => {
    let active = true;
    let url: string | null = null;
    setBuilding(true);
    setError(null);
    setNote(null);

    renderShareImage(subject, templateId)
      .then((result) => {
        if (!active) return;
        url = URL.createObjectURL(result);
        setBlob(result);
        setPreview(url);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Could not build the image",
        );
      })
      .finally(() => {
        if (active) setBuilding(false);
      });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [subject, templateId]);

  // Memoised so `shareImage` stays stable and `canShareFiles` isn't re-probed
  // on every render.
  const file = useMemo(
    () =>
      blob
        ? new File([blob], shareFileName(subject, templateId), {
            type: "image/png",
          })
        : null,
    [blob, subject, templateId],
  );

  const shareImage = useCallback(async () => {
    if (!file) return;
    try {
      await navigator.share({
        files: [file],
        title: `STIFF — ${subject.title}`,
        text: `${subject.title} — the STIFF archive`,
      });
    } catch (err) {
      // A cancelled share sheet is not an error worth surfacing.
      if (err instanceof Error && err.name === "AbortError") return;
      setNote("Sharing was blocked — download the image instead.");
    }
  }, [file, subject.title]);

  function download() {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = shareFileName(subject, templateId);
    a.click();
    setNote("Saved. Open Instagram or Facebook and add it to your story.");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(subject.url);
      setNote("Link copied.");
    } catch {
      setNote("Could not copy — your browser blocked clipboard access.");
    }
  }

  const template = SHARE_TEMPLATES.find((t) => t.id === templateId);
  const isStory = template?.height !== template?.width;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Share ${subject.title}`}
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-end justify-center bg-foreground/80 p-0 sm:items-center sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92svh] w-full max-w-3xl flex-col overflow-y-auto rounded-t-[2px] border border-subtle bg-background sm:rounded-[2px]"
      >
        <div className="flex items-center justify-between border-b border-subtle px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted">
            Share {subject.title}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-[2px] text-lg text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            ×
          </button>
        </div>

        <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          {/* Preview */}
          <div className="mx-auto w-full max-w-[240px]">
            <div
              className={`flex items-center justify-center overflow-hidden rounded-[2px] bg-surface ${
                isStory ? "aspect-[9/16]" : "aspect-square"
              }`}
            >
              {building && <Spinner className="size-6" />}
              {!building && preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt={`${subject.title} share preview`}
                  className="h-full w-full object-contain"
                />
              )}
              {!building && error && (
                <p className="px-4 text-center text-xs text-muted">{error}</p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-5">
            <fieldset>
              <legend className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                Design
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {SHARE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={t.id === templateId}
                    onClick={() => setTemplateId(t.id)}
                    className={`flex flex-col items-start rounded-[2px] px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
                      t.id === templateId
                        ? "bg-foreground text-background"
                        : "border border-subtle text-muted hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em]">
                      {t.label}
                    </span>
                    <span className="text-[9px] font-medium uppercase tracking-[0.15em] opacity-70">
                      {t.hint}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                Post it
              </p>
              {file && canShareFiles(file) ? (
                <button
                  type="button"
                  onClick={shareImage}
                  disabled={building}
                  className={btnSolidSm}
                >
                  Share to Instagram / Facebook
                </button>
              ) : (
                <button
                  type="button"
                  onClick={download}
                  disabled={building || !preview}
                  className={btnSolidSm}
                >
                  Download for stories
                </button>
              )}
              <p className="text-[11px] leading-5 text-muted">
                {file && canShareFiles(file)
                  ? "Opens your share sheet — pick Instagram or Facebook, then Stories."
                  : "Stories can only be posted from the app. Save the image, then add it to your story."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                Or share the link
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copyLink} className={btnOutline}>
                  Copy link
                </button>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(subject.url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={btnOutline}
                >
                  Facebook
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(subject.url)}&text=${encodeURIComponent(`${subject.title} — the STIFF archive`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={btnOutline}
                >
                  X
                </a>
                {preview && (
                  <button
                    type="button"
                    onClick={download}
                    className={btnOutline}
                  >
                    Save image
                  </button>
                )}
              </div>
            </div>

            <p aria-live="polite" className="min-h-4 text-[11px] text-muted">
              {note}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
