"use client";

import { useRef, useState } from "react";
import { adminApi, galleryApi } from "@/lib/api";
import type { GalleryItem, UploadedImage } from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import { imageUrl } from "@/lib/image";
import {
  btnGhostSm,
  btnOutline,
  btnSolidSm,
  ErrorNote,
  inputCls,
  labelCls,
  Loading,
} from "../ui";

/** A file that has reached Cloudinary and is waiting to be described. */
interface Draft {
  /** Local id — the upload has no database row yet. */
  key: string;
  fileName: string;
  image: UploadedImage;
  title: string;
  altText: string;
  description: string;
}

/**
 * The gallery is the whole site until the shop opens, so adding to it has to
 * be quick: pick a folder of files, let the archive number them, write alt
 * text where it matters, publish in one request.
 */
export function GalleryTab() {
  const { data, loading, error, reload } = useAsync(
    () => galleryApi.listGallery({ pageSize: 50, includeArchived: true }),
    [],
  );
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList) {
    setNote(null);
    setUploading((n) => n + files.length);
    // Sequential: a shoot is a dozen 10MB files and firing them all at once
    // just makes every one of them slow.
    for (const file of Array.from(files)) {
      try {
        const image = await adminApi.uploadImage(file);
        setDrafts((prev) => [
          ...prev,
          {
            key: `${file.name}-${Date.now()}-${prev.length}`,
            fileName: file.name,
            image,
            title: "",
            altText: "",
            description: "",
          },
        ]);
      } catch (err) {
        setNote(`${file.name}: ${errorMessage(err)}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function editDraft(key: string, patch: Partial<Draft>) {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    );
  }

  async function publish() {
    if (drafts.length === 0) return;
    setBusy(true);
    setNote(null);
    try {
      const created = await adminApi.createGalleryItems(
        drafts.map((d) => ({
          title: d.title.trim() || undefined,
          altText: d.altText.trim() || undefined,
          description: d.description.trim() || undefined,
          imageUrl: d.image.url,
          width: d.image.width ?? undefined,
          height: d.image.height ?? undefined,
        })),
      );
      setDrafts([]);
      setNote(
        `Published ${created.length} shot${created.length === 1 ? "" : "s"}.`,
      );
      reload();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <p className={labelCls}>New shots</p>

        <div className="flex flex-wrap items-center gap-3">
          <label className={`${btnOutline} cursor-pointer`}>
            {uploading > 0 ? `Uploading ${uploading}…` : "Choose images"}
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) void addFiles(files);
              }}
              className="sr-only"
            />
          </label>
          {drafts.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => void publish()}
                disabled={busy || uploading > 0}
                className={btnSolidSm}
              >
                {busy
                  ? "Publishing…"
                  : `Publish ${drafts.length} shot${drafts.length === 1 ? "" : "s"}`}
              </button>
              <button
                type="button"
                onClick={() => setDrafts([])}
                disabled={busy}
                className={btnGhostSm}
              >
                Discard
              </button>
            </>
          )}
        </div>

        <p className="max-w-xl text-xs leading-6 text-muted">
          Leave a title blank and the shot carries on the archive numbering.
          Alt text describes the photograph for screen readers and search —
          worth writing, the number alone tells them nothing.
        </p>

        {drafts.length > 0 && (
          <ul className="flex flex-col gap-4">
            {drafts.map((draft) => (
              <li
                key={draft.key}
                className="flex flex-col gap-3 border border-subtle p-3 sm:flex-row sm:items-start"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(draft.image.url, 192)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-24 shrink-0 rounded-[2px] bg-surface object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="truncate text-[10px] uppercase tracking-[0.15em] text-muted">
                    {draft.fileName}
                  </p>
                  <input
                    value={draft.title}
                    onChange={(e) =>
                      editDraft(draft.key, { title: e.target.value })
                    }
                    maxLength={120}
                    placeholder="Title — blank to auto-number"
                    aria-label={`Title for ${draft.fileName}`}
                    className={`${inputCls} h-10`}
                  />
                  <input
                    value={draft.altText}
                    onChange={(e) =>
                      editDraft(draft.key, { altText: e.target.value })
                    }
                    maxLength={300}
                    placeholder="Alt text — describe the photograph"
                    aria-label={`Alt text for ${draft.fileName}`}
                    className={`${inputCls} h-10`}
                  />
                  <input
                    value={draft.description}
                    onChange={(e) =>
                      editDraft(draft.key, { description: e.target.value })
                    }
                    maxLength={2000}
                    placeholder="Caption (optional)"
                    aria-label={`Caption for ${draft.fileName}`}
                    className={`${inputCls} h-10`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDrafts((prev) =>
                      prev.filter((d) => d.key !== draft.key),
                    )
                  }
                  className={`${btnGhostSm} self-start`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <p aria-live="polite" className="min-h-4 text-xs text-muted">
          {note}
        </p>
      </section>

      <section>
        <p className={labelCls}>Archive ({data?.total ?? 0})</p>
        {loading && <Loading label="Loading gallery" />}
        {error && <ErrorNote message={error} />}
        {data && (
          <ArchiveList
            items={data.items}
            onChanged={reload}
            onError={setNote}
          />
        )}
      </section>
    </div>
  );
}

/**
 * The existing archive, in running order. Order is edited by moving a shot up
 * or down rather than by drag-and-drop: it works on touch, it works with a
 * keyboard, and there is no drag library to carry.
 */
function ArchiveList({
  items,
  onChanged,
  onError,
}: {
  items: GalleryItem[];
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [order, setOrder] = useState<GalleryItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const list = order ?? items;
  const dirty = order !== null;

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  async function save() {
    if (!order) return;
    setSaving(true);
    try {
      await adminApi.reorderGallery(
        order.map((item, index) => ({ id: item.id, sortOrder: index })),
      );
      setOrder(null);
      onChanged();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {dirty && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className={btnSolidSm}
          >
            {saving ? "Saving…" : "Save order"}
          </button>
          <button
            type="button"
            onClick={() => setOrder(null)}
            disabled={saving}
            className={btnGhostSm}
          >
            Cancel
          </button>
        </div>
      )}

      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {list.map((item, index) => (
          <li key={item.id}>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(item.imageUrl, 320)}
                alt={item.altText ?? item.title}
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
            {!item.altText && (
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted/60">
                No alt text
              </p>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${item.title} earlier`}
                className={btnGhostSm}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === list.length - 1}
                aria-label={`Move ${item.title} later`}
                className={btnGhostSm}
              >
                ↓
              </button>
              <AltTextButton item={item} onChanged={onChanged} onError={onError} />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await adminApi.updateGalleryItem(item.id, {
                      isArchived: !item.isArchived,
                    });
                    onChanged();
                  } catch (err) {
                    onError(errorMessage(err));
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
                    onChanged();
                  } catch (err) {
                    onError(errorMessage(err));
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
    </>
  );
}

/** Inline alt-text editing, so a missing description is one click from fixed. */
function AltTextButton({
  item,
  onChanged,
  onError,
}: {
  item: GalleryItem;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.altText ?? "");
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(item.altText ?? "");
          setEditing(true);
        }}
        className={btnGhostSm}
      >
        {item.altText ? "Edit alt" : "Add alt"}
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await adminApi.updateGalleryItem(item.id, { altText: value.trim() });
          setEditing(false);
          onChanged();
        } catch (err) {
          onError(errorMessage(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={300}
        autoFocus
        aria-label={`Alt text for ${item.title}`}
        className={`${inputCls} h-9 text-xs`}
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className={btnGhostSm}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className={btnGhostSm}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
