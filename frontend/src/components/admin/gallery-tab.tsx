"use client";

import { Fragment, useState } from "react";
import { adminApi, galleryApi, productsApi } from "@/lib/api";
import type {
  GalleryItem,
  GalleryShoot,
  GalleryTagWithCount,
  Product,
} from "@/lib/api";
import { fetchAll } from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import { asRotation, imageUrl } from "@/lib/image";
import { GalleryShoots } from "./gallery-shoots";
import { GalleryTags } from "./gallery-tags";
import { GalleryUpload } from "./gallery-upload";
import { ShotEditor } from "./shot-editor";
import {
  btnGhostSm,
  btnSolidSm,
  ErrorNote,
  inputCls,
  labelCls,
  Loading,
} from "../ui";

const TURNS = [0, 90, 180, 270] as const;

async function rotateShot(
  item: GalleryItem,
  direction: 1 | -1,
  onChanged: () => void,
  onError: (message: string) => void,
) {
  const current = asRotation(item.rotation);
  const next = TURNS[(TURNS.indexOf(current) + direction + 4) % 4];
  try {
    await adminApi.updateGalleryItem(item.id, { rotation: next });
    onChanged();
  } catch (err) {
    onError(errorMessage(err));
  }
}

/**
 * Staging a new shoot, filing it, and maintaining what's already published.
 */
export function GalleryTab() {
  const { data, loading, error, reload } = useAsync(
    () => galleryApi.listGallery({ pageSize: 50, includeArchived: true }),
    [],
  );
  // Fetched once for the whole archive rather than per shot — the editor is
  // opened on one item at a time, but the catalogue, the shoots and the tags
  // are the same lists for all of them.
  const { data: catalogue } = useAsync(
    () => fetchAll(productsApi.listProducts, { sort: "newest" as const }),
    [],
  );
  const { data: shoots, reload: reloadShoots } = useAsync(
    () => galleryApi.listShoots(),
    [],
  );
  const { data: tags, reload: reloadTags } = useAsync(
    () => galleryApi.listTags(),
    [],
  );
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-12">
      <GalleryUpload onPublished={reload} />

      <GalleryShoots onError={setNote} />

      <GalleryTags
        tags={tags ?? []}
        onChanged={reloadTags}
        onError={setNote}
      />

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className={labelCls}>Archive ({data?.total ?? 0})</p>
          <PlaceholderButton onNote={setNote} onChanged={reload} />
        </div>
        {loading && <Loading label="Loading gallery" />}
        {error && <ErrorNote message={error} />}
        <p aria-live="polite" className="min-h-4 text-xs text-muted">
          {note}
        </p>
        {data && (
          <ArchiveList
            items={data.items}
            products={catalogue ?? []}
            shoots={shoots ?? []}
            tags={tags ?? []}
            onChanged={() => {
              reload();
              // Filing a shot changes the shoot counts and the tag counts, and
              // a stale count next to a live filter is a bug report.
              reloadShoots();
              reloadTags();
            }}
            onError={setNote}
          />
        )}
      </section>
    </div>
  );
}

/**
 * Fills in blur placeholders for the archive that predates them.
 *
 * New uploads generate theirs on publish, so this is a one-off — but it is a
 * button rather than a migration because it depends on Cloudinary answering,
 * and a migration that needs a third party is a migration that fails on a bad
 * afternoon.
 */
function PlaceholderButton({
  onNote,
  onChanged,
}: {
  onNote: (message: string) => void;
  onChanged: () => void;
}) {
  const [running, setRunning] = useState(false);

  return (
    <button
      type="button"
      disabled={running}
      onClick={async () => {
        setRunning(true);
        onNote("Generating placeholders…");
        try {
          const result = await adminApi.backfillGalleryPlaceholders();
          onNote(
            result.processed === 0
              ? "Every shot already has a placeholder."
              : `Filled ${result.filled} of ${result.processed}.`,
          );
          onChanged();
        } catch (err) {
          onNote(errorMessage(err));
        } finally {
          setRunning(false);
        }
      }}
      className={btnGhostSm}
    >
      {running ? "Generating…" : "Fill placeholders"}
    </button>
  );
}

/**
 * The existing archive, in running order. Order is edited by moving a shot up
 * or down rather than by drag-and-drop: it works on touch, it works with a
 * keyboard, and there is no drag library to carry.
 */
function ArchiveList({
  items,
  products,
  shoots,
  tags,
  onChanged,
  onError,
}: {
  items: GalleryItem[];
  products: Product[];
  shoots: GalleryShoot[];
  tags: GalleryTagWithCount[];
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [order, setOrder] = useState<GalleryItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
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
          <Fragment key={item.id}>
          <li>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(item.imageUrl, 320, "tile", item.rotation)}
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
              <button
                type="button"
                onClick={() =>
                  void rotateShot(item, -1, onChanged, onError)
                }
                aria-label={`Rotate ${item.title} counter-clockwise`}
                className={btnGhostSm}
              >
                ↺
              </button>
              <button
                type="button"
                onClick={() =>
                  void rotateShot(item, 1, onChanged, onError)
                }
                aria-label={`Rotate ${item.title} clockwise`}
                className={btnGhostSm}
              >
                ↻
              </button>
              <AltTextButton item={item} onChanged={onChanged} onError={onError} />
              <button
                type="button"
                onClick={() =>
                  setEditing(editing === item.id ? null : item.id)
                }
                className={btnGhostSm}
              >
                {editing === item.id ? "Close" : "Shoot, tags, pieces"}
              </button>
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
          {editing === item.id && (
            <ShotEditor
              item={item}
              products={products}
              shoots={shoots}
              tags={tags}
              onSaved={onChanged}
              onClose={() => setEditing(null)}
              onError={onError}
            />
          )}
          </Fragment>
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
