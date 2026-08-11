"use client";

import { useRef, useState } from "react";
import { adminApi, galleryApi } from "@/lib/api";
import type { UploadedImage } from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import { imageUrl } from "@/lib/image";
import {
  btnGhostSm,
  btnOutline,
  btnSolidSm,
  ErrorNote,
  Field,
  inputCls,
  labelCls,
  Loading,
  textareaCls,
} from "../ui";

export function GalleryTab() {
  const { data, loading, error, reload } = useAsync(
    () => galleryApi.listGallery({ pageSize: 50, includeArchived: true }),
    [],
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-12">
      <form
        className="flex max-w-xl flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!image) {
            setNote("Upload an image first.");
            return;
          }
          setBusy(true);
          setNote(null);
          try {
            await adminApi.createGalleryItem({
              title,
              description: description || undefined,
              imageUrl: image.url,
              width: image.width ?? undefined,
              height: image.height ?? undefined,
            });
            setTitle("");
            setDescription("");
            setImage(null);
            setNote("Added to gallery.");
            reload();
          } catch (err) {
            setNote(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className={labelCls}>New gallery shot</p>
        <Field id="g-title" label="Title">
          <input
            id="g-title"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field id="g-desc" label="Description (optional)">
          <textarea
            id="g-desc"
            rows={2}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={textareaCls}
          />
        </Field>
        <div className="flex items-center gap-3">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(image.url, 192)}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-24 rounded-[2px] bg-surface object-cover"
            />
          ) : null}
          <label className={`${btnOutline} cursor-pointer`}>
            {uploading ? "Uploading…" : image ? "Replace image" : "Upload image"}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setNote(null);
                try {
                  setImage(await adminApi.uploadImage(file));
                } catch (err) {
                  setNote(errorMessage(err));
                } finally {
                  setUploading(false);
                  if (fileInput.current) fileInput.current.value = "";
                }
              }}
              className="sr-only"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy || uploading}
          className={`${btnSolidSm} self-start`}
        >
          {busy ? "Saving…" : "Add to gallery"}
        </button>
        <p aria-live="polite" className="min-h-4 text-xs text-muted">
          {note}
        </p>
      </form>

      <div>
        <p className={labelCls}>Gallery ({data?.total ?? 0})</p>
        {loading && <Loading label="Loading gallery" />}
        {error && <ErrorNote message={error} />}
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {data?.items.map((item) => (
            <li key={item.id}>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(item.imageUrl, 320)}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  className={`aspect-square w-full rounded-[2px] bg-surface object-cover ${
                    item.isArchived ? "opacity-40" : ""
                  }`}
                />
                {item.isArchived && (
                  <span className="absolute left-0 top-0 w-full bg-foreground py-1 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-background">
                    Archived
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                {item.title}
              </p>
              <div className="mt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await adminApi.updateGalleryItem(item.id, {
                        isArchived: !item.isArchived,
                      });
                      reload();
                    } catch (err) {
                      setNote(errorMessage(err));
                    }
                  }}
                  className={btnGhostSm}
                >
                  {item.isArchived ? "Unarchive" : "Archive"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Delete "${item.title}" forever?`)) return;
                    try {
                      await adminApi.deleteGalleryItem(item.id);
                      reload();
                    } catch (err) {
                      setNote(errorMessage(err));
                    }
                  }}
                  className={btnGhostSm}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
