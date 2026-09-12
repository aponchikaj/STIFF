"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/api";
import type { UploadedImage } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { imageUrl } from "@/lib/image";
import {
  Badge,
  btnGhost,
  btnPrimarySm,
  inputCls,
  Note,
  Panel,
  Spinner,
} from "../ui";

const ACCEPT = "image/jpeg,image/png,image/webp";

/** Matches the backend's multer limit — caught here so the trip is skipped. */
const MAX_BYTES = 15 * 1024 * 1024;

type DraftStatus = "uploading" | "ready" | "failed";

interface Draft {
  key: string;
  file: File;
  /** Object URL — shown while the upload is in flight, revoked on removal. */
  localPreview: string;
  status: DraftStatus;
  error: string | null;
  image: UploadedImage | null;
  title: string;
  altText: string;
  description: string;
}

let counter = 0;

function draftFrom(file: File): Draft {
  counter += 1;
  return {
    key: `${file.name}-${counter}`,
    file,
    localPreview: URL.createObjectURL(file),
    status: "uploading",
    error: null,
    image: null,
    title: "",
    altText: "",
    description: "",
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Staging area for a shoot.
 *
 * Files land here as cards straight away and upload in the background, so the
 * page shows what's happening instead of a button that says "Uploading…" for
 * a minute. Each card can be described, retried on its own, or dropped, and
 * the whole batch is published in one request.
 */
export function GalleryUpload({ onPublished }: { onPublished: () => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Object URLs outlive the component unless they're released by hand.
  useEffect(() => {
    return () => {
      for (const draft of drafts) URL.revokeObjectURL(draft.localPreview);
    };
    // Intentionally on unmount only — per-draft cleanup happens in remove().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = useCallback((key: string, next: Partial<Draft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...next } : d)),
    );
  }, []);

  const upload = useCallback(
    async (draft: Draft) => {
      try {
        const image = await adminApi.uploadImage(draft.file);
        patch(draft.key, { status: "ready", image, error: null });
      } catch (err) {
        patch(draft.key, { status: "failed", error: errorMessage(err) });
      }
    },
    [patch],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const accepted: Draft[] = [];
      const rejected: string[] = [];

      for (const file of files) {
        if (!ACCEPT.split(",").includes(file.type)) {
          rejected.push(`${file.name} — only jpg, png and webp`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          rejected.push(`${file.name} — over ${formatBytes(MAX_BYTES)}`);
          continue;
        }
        accepted.push(draftFrom(file));
      }

      setNote(rejected.length > 0 ? rejected.join(" · ") : null);
      if (accepted.length === 0) return;

      setDrafts((prev) => [...prev, ...accepted]);
      // Sequential: a shoot is a dozen large files, and firing them all at
      // once only makes every one of them slower.
      void (async () => {
        for (const draft of accepted) await upload(draft);
      })();
    },
    [upload],
  );

  function remove(key: string) {
    setDrafts((prev) => {
      const going = prev.find((d) => d.key === key);
      if (going) URL.revokeObjectURL(going.localPreview);
      return prev.filter((d) => d.key !== key);
    });
  }

  function clearAll() {
    for (const draft of drafts) URL.revokeObjectURL(draft.localPreview);
    setDrafts([]);
    setNote(null);
  }

  const ready = drafts.filter((d) => d.status === "ready");
  const uploading = drafts.filter((d) => d.status === "uploading").length;
  const failed = drafts.filter((d) => d.status === "failed").length;
  const missingAlt = ready.filter((d) => !d.altText.trim()).length;

  async function publish() {
    if (ready.length === 0) return;
    setBusy(true);
    setNote(null);
    try {
      const created = await adminApi.createGalleryItems(
        ready.map((d) => ({
          title: d.title.trim() || undefined,
          altText: d.altText.trim() || undefined,
          description: d.description.trim() || undefined,
          imageUrl: d.image!.url,
          width: d.image!.width ?? undefined,
          height: d.image!.height ?? undefined,
        })),
      );
      const publishedKeys = new Set(ready.map((d) => d.key));
      setDrafts((prev) => {
        for (const d of prev) {
          if (publishedKeys.has(d.key)) URL.revokeObjectURL(d.localPreview);
        }
        return prev.filter((d) => !publishedKeys.has(d.key));
      });
      setNote(
        `Published ${created.length} shot${created.length === 1 ? "" : "s"}.`,
      );
      onPublished();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      eyebrow="Upload"
      title="New shots"
      aside={
        drafts.length > 0 ? (
          <p className="tnum text-[11px] text-faint">
            {ready.length} ready
            {uploading > 0 && ` · ${uploading} uploading`}
            {failed > 0 && ` · ${failed} failed`}
          </p>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {/* ---- Drop zone ---- */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            // Ignore the flicker from crossing a child element.
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(Array.from(e.dataTransfer.files));
          }}
          className={`flex flex-col items-center justify-center gap-3 rounded-[var(--radius-control)] border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragging
              ? "border-ink bg-raised"
              : "border-line hover:border-line-strong"
          }`}
        >
          <p className="text-[13px] text-muted">
            {dragging ? "Drop to add" : "Drag images here"}
          </p>
          <label className={`${btnPrimarySm} cursor-pointer`}>
            Choose files
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT}
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                if (fileInput.current) fileInput.current.value = "";
              }}
              className="sr-only"
            />
          </label>
          <p className="max-w-sm text-[11px] leading-5 text-faint">
            jpg, png, webp · up to {formatBytes(MAX_BYTES)} each
          </p>
        </div>

        {/* ---- Action bar ---- */}
        {drafts.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-line bg-raised px-3 py-2.5">
            <button
              type="button"
              onClick={() => void publish()}
              disabled={busy || ready.length === 0 || uploading > 0}
              className={btnPrimarySm}
            >
              {busy
                ? "Publishing…"
                : `Publish ${ready.length} shot${ready.length === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={busy}
              className={btnGhost}
            >
              Clear all
            </button>
            {missingAlt > 0 && (
              <Badge tone="caution">{missingAlt} without alt text</Badge>
            )}
          </div>
        )}

        {/* ---- Draft cards ---- */}
        {drafts.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {drafts.map((draft) => (
              <li
                key={draft.key}
                className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-line p-3"
              >
                <div className="flex gap-3">
                  <div className="relative size-20 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        draft.image
                          ? imageUrl(draft.image.url, 192)
                          : draft.localPreview
                      }
                      alt=""
                      className={`size-20 rounded-[var(--radius-control)] bg-raised object-cover ${
                        draft.status === "ready" ? "" : "opacity-40"
                      }`}
                    />
                    {draft.status === "uploading" && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Spinner className="size-5" />
                      </span>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {draft.file.name}
                    </p>
                    <p className="tnum text-[11px] text-faint">
                      {formatBytes(draft.file.size)}
                      {draft.image?.width && draft.image.height
                        ? ` · ${draft.image.width}×${draft.image.height}`
                        : ""}
                    </p>
                    {draft.status === "failed" && (
                      <p
                        role="alert"
                        className="text-[11px] leading-5 text-danger"
                      >
                        {draft.error}
                      </p>
                    )}
                    <div className="mt-auto flex items-center gap-3">
                      {draft.status === "failed" && (
                        <button
                          type="button"
                          onClick={() => {
                            patch(draft.key, {
                              status: "uploading",
                              error: null,
                            });
                            void upload(draft);
                          }}
                          className={btnGhost}
                        >
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(draft.key)}
                        className={btnGhost}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>

                {draft.status === "ready" && (
                  <div className="flex flex-col gap-2">
                    <input
                      value={draft.title}
                      onChange={(e) =>
                        patch(draft.key, { title: e.target.value })
                      }
                      maxLength={120}
                      placeholder="Title — blank to auto-number"
                      aria-label={`Title for ${draft.file.name}`}
                      className={`${inputCls} h-9`}
                    />
                    <div>
                      <input
                        value={draft.altText}
                        onChange={(e) =>
                          patch(draft.key, { altText: e.target.value })
                        }
                        maxLength={300}
                        placeholder="Alt text — describe the photograph"
                        aria-label={`Alt text for ${draft.file.name}`}
                        className={`${inputCls} h-9 ${
                          draft.altText.trim() ? "" : "border-caution/50"
                        }`}
                      />
                      <p className="mt-1 text-[11px] leading-5 text-faint">
                        {draft.altText.trim()
                          ? `${draft.altText.length}/300`
                          : "Read aloud instead of the catalogue number"}
                      </p>
                    </div>
                    <input
                      value={draft.description}
                      onChange={(e) =>
                        patch(draft.key, { description: e.target.value })
                      }
                      maxLength={2000}
                      placeholder="Caption (optional)"
                      aria-label={`Caption for ${draft.file.name}`}
                      className={`${inputCls} h-9`}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <Note>{note}</Note>
      </div>
    </Panel>
  );
}
