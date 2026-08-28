"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  renderShareImage,
  shareFileName,
  SHARE_TEMPLATES,
  type ShareSubject,
  type ShareTemplateId,
} from "@/lib/share-image";
import { XIcon } from "./icons";
import { btnOutline, btnSolid, Spinner } from "./ui";

/**
 * Share dialog for a gallery shot or a product.
 *
 * Instagram and Facebook have no web API for posting to Stories — the only
 * routes from a browser are the OS share sheet (which lists both apps) or the
 * camera roll. So the branded image is generated here and then handed off:
 * `navigator.share` with the file on mobile, a download everywhere else.
 * Link-only targets (Facebook feed, X) fall back to their web intents, which
 * pull the page's Open Graph card.
 *
 * It renders through a portal like the cart drawer does. The triggers sit
 * inside hover-reveal wrappers on grid tiles, and a dialog nested in one
 * inherits that wrapper's `opacity-0` — and its stacking context — so the
 * sheet has to leave the tile's subtree to be reliably visible.
 *
 * Layout is a bottom sheet on phones and a centred dialog from `sm` up. The
 * preview is capped by viewport height rather than a fixed width, and the
 * primary action is pinned to a footer outside the scroll area, so opening
 * the sheet never buries the one control it exists for.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

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
  open,
  onClose,
}: {
  subject: ShareSubject;
  open: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const titleId = useId();
  // Callers build the subject inline (`productShareSubject(product)`), so the
  // object is new on every render. Keying the canvas render on its identity
  // would recompose the image each time; key it on the fields instead.
  const { title, imageUrl, caption, url, kicker, rotation } = subject;
  const stable = useMemo<ShareSubject>(
    () => ({ title, imageUrl, caption, url, kicker, rotation }),
    [title, imageUrl, caption, url, kicker, rotation],
  );
  const [mounted, setMounted] = useState(false);
  const [templateId, setTemplateId] = useState<ShareTemplateId>("frame");
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [building, setBuilding] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Callers pass an inline `onClose`, so it changes identity every render.
  // Depending on it directly would tear down and re-run the effect below on
  // each one — re-running the focus restore mid-dialog and yanking focus back
  // to the trigger. The ref keeps the latest handler without the dependency.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Escape closes; Tab cycles inside the panel. Without the trap, tabbing runs
  // off into the page behind, which is still fully interactive under the
  // backdrop. Focus returns to whatever opened the sheet.
  // `mounted` is in the dependencies because the portal — and therefore the
  // close button this focuses — does not exist on the first render.
  useEffect(() => {
    if (!open || !mounted) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes?.length) return;
      const list = Array.from(nodes).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus?.();
    };
  }, [open, mounted]);

  // Re-render whenever the chosen design changes. The object URL is revoked on
  // cleanup so switching designs repeatedly doesn't leak.
  useEffect(() => {
    if (!open) return;
    let active = true;
    let url: string | null = null;
    setBuilding(true);
    setError(null);
    setNote(null);

    renderShareImage(stable, templateId)
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
  }, [open, stable, templateId]);

  // Memoised so `shareImage` stays stable and `canShareFiles` isn't re-probed
  // on every render.
  const file = useMemo(
    () =>
      blob
        ? new File([blob], shareFileName(stable, templateId), {
            type: "image/png",
          })
        : null,
    [blob, stable, templateId],
  );

  const shareImage = useCallback(async () => {
    if (!file) return;
    try {
      await navigator.share({
        files: [file],
        title: `STIFF — ${title}`,
        text: `${title} — the STIFF archive`,
      });
    } catch (err) {
      // A cancelled share sheet is not an error worth surfacing.
      if (err instanceof Error && err.name === "AbortError") return;
      setNote("Sharing was blocked — download the image instead.");
    }
  }, [file, title]);

  const download = useCallback(() => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = shareFileName(stable, templateId);
    a.click();
    setNote("Saved. Open Instagram or Facebook and add it to your story.");
  }, [preview, stable, templateId]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied.");
    } catch {
      setNote("Could not copy — your browser blocked clipboard access.");
    }
  }

  const template = SHARE_TEMPLATES.find((t) => t.id === templateId);
  const isStory = template?.height !== template?.width;
  const nativeShare = Boolean(file && canShareFiles(file));

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-foreground/80"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduce ? false : { opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 32 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="relative flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2px] border border-subtle bg-background sm:max-h-[86dvh] sm:rounded-[2px]"
          >
            {/* Grab handle — the affordance that says "this sheet moves". */}
            <div
              aria-hidden="true"
              className="flex shrink-0 justify-center pt-2 sm:hidden"
            >
              <span className="h-1 w-10 rounded-full bg-subtle" />
            </div>

            <div className="flex shrink-0 items-center justify-between border-b border-subtle py-3 pl-5 pr-2 sm:py-4 sm:pr-3">
              <p
                id={titleId}
                className="truncate text-[11px] font-medium uppercase tracking-[0.25em] text-muted"
              >
                Share {subject.title}
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-11 shrink-0 items-center justify-center rounded-[2px] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted sm:size-10"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            {/* Everything that may overflow scrolls; the action bar never does. */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
                {/* Preview — bounded by viewport height on phones so it can
                    never push the controls off-screen. */}
                <div
                  className={`mx-auto flex h-[26dvh] items-center justify-center overflow-hidden rounded-[2px] bg-surface sm:h-auto sm:w-full sm:max-w-[240px] ${
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
                    <p className="px-4 text-center text-xs text-muted">
                      {error}
                    </p>
                  )}
                </div>

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
                          className={`flex min-h-11 flex-col items-start justify-center rounded-[2px] px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
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
                      Or share the link
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={copyLink}
                        className={btnOutline}
                      >
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
                </div>
              </div>
            </div>

            {/* Pinned action bar — the primary control stays in the thumb zone
                and in view no matter how tall the content above it gets. */}
            <div className="shrink-0 border-t border-subtle bg-background px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={nativeShare ? shareImage : download}
                disabled={building || (!nativeShare && !preview)}
                className={`${btnSolid} w-full`}
              >
                {nativeShare ? "Share to Instagram / Facebook" : "Download for stories"}
              </button>
              <p className="mt-2 text-[11px] leading-5 text-muted">
                {nativeShare
                  ? "Opens your share sheet — pick Instagram or Facebook, then Stories."
                  : "Stories can only be posted from the app. Save the image, then add it to your story."}
              </p>
              <p aria-live="polite" className="min-h-4 text-[11px] text-muted">
                {note}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
