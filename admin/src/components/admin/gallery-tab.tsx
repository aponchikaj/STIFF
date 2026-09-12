"use client";

import { useState } from "react";
import { adminApi, galleryApi, productsApi } from "@/lib/api";
import type { GalleryItem, Product } from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import { asRotation, imageUrl } from "@/lib/image";
import { GalleryUpload } from "./gallery-upload";
import {
  Badge,
  btnGhost,
  btnPrimarySm,
  checkboxCls,
  Empty,
  ErrorNote,
  inputCls,
  labelCls,
  Loading,
  Note,
  Panel,
} from "../ui";

const TURNS = [0, 90, 180, 270] as const;

/** A square control for the reorder and rotate affordances. */
const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] border border-line text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

const dangerGhost = "text-danger hover:text-danger";

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
 * Two halves: staging a new shoot, and maintaining what's already published.
 */
export function GalleryTab() {
  const { data, loading, error, reload } = useAsync(
    () => galleryApi.listGallery({ pageSize: 50, includeArchived: true }),
    [],
  );
  // Fetched once for the whole archive rather than per shot — the picker is
  // opened on one item at a time, but the catalogue is the same list for all
  // of them.
  const { data: catalogue } = useAsync(
    () => productsApi.listProducts({ pageSize: 100, sort: "newest" }),
    [],
  );
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <GalleryUpload onPublished={reload} />

      <ArchiveList
        items={data?.items ?? null}
        total={data?.total ?? 0}
        products={catalogue?.items ?? []}
        loading={loading}
        error={error}
        note={note}
        onChanged={reload}
        onError={setNote}
      />
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
  total,
  products,
  loading,
  error,
  note,
  onChanged,
  onError,
}: {
  items: GalleryItem[] | null;
  total: number;
  products: Product[];
  loading: boolean;
  error: string | null;
  note: string | null;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [order, setOrder] = useState<GalleryItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const list = order ?? items ?? [];
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
    <Panel
      eyebrow="Published"
      title="Archive"
      aside={
        <>
          <span className="tnum text-[11px] text-faint">{total} shots</span>
          {dirty && (
            <>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className={btnPrimarySm}
              >
                {saving ? "Saving…" : "Save order"}
              </button>
              <button
                type="button"
                onClick={() => setOrder(null)}
                disabled={saving}
                className={btnGhost}
              >
                Cancel
              </button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {loading && <Loading label="Loading gallery" />}
        {error && <ErrorNote message={error} />}
        <Note>{note}</Note>

        {items && list.length === 0 && !loading && (
          <Empty>Nothing published yet — upload a shoot above.</Empty>
        )}

        {list.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {list.map((item, index) => (
              <li
                key={item.id}
                className="flex flex-col gap-2.5 rounded-[var(--radius-control)] border border-line p-3"
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl(item.imageUrl, 320, "tile", item.rotation)}
                    alt={item.altText ?? item.title}
                    loading="lazy"
                    decoding="async"
                    className={`aspect-square w-full rounded-[var(--radius-control)] bg-raised object-cover ${
                      item.isArchived ? "opacity-40" : ""
                    }`}
                  />
                  {item.isArchived && (
                    <span className="absolute left-2 top-2">
                      <Badge tone="solid">Archived</Badge>
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {item.title}
                  </p>
                  {!item.altText && (
                    <p className="text-[11px] leading-5 text-caution">
                      No alt text
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${item.title} earlier`}
                    className={iconBtn}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === list.length - 1}
                    aria-label={`Move ${item.title} later`}
                    className={iconBtn}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => void rotateShot(item, -1, onChanged, onError)}
                    aria-label={`Rotate ${item.title} counter-clockwise`}
                    className={iconBtn}
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    onClick={() => void rotateShot(item, 1, onChanged, onError)}
                    aria-label={`Rotate ${item.title} clockwise`}
                    className={iconBtn}
                  >
                    ↻
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <AltTextButton
                    item={item}
                    onChanged={onChanged}
                    onError={onError}
                  />
                  <LinkedProductsButton
                    item={item}
                    products={products}
                    onError={onError}
                  />
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
                    className={btnGhost}
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
                    className={`${btnGhost} ${dangerGhost}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
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
        className={btnGhost}
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
        className={`${inputCls} h-9`}
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className={btnGhost}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className={btnGhost}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Which pieces are worn in a shot.
 *
 * The links drive "Seen in the archive" on the product page and "Shop the
 * look" here, so tagging a shoot once pays on both sides. The current links
 * are fetched on open rather than carried in the list response — the archive
 * grid does not otherwise need them, and it is 50 shots per page.
 */
function LinkedProductsButton({
  item,
  products,
  onError,
}: {
  item: GalleryItem;
  products: Product[];
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  async function open() {
    setEditing(true);
    try {
      const detail = await galleryApi.getGalleryItem(item.slug);
      const ids = (detail.products ?? []).map((p) => p.id);
      setSelected(ids);
      setCount(ids.length);
    } catch (err) {
      onError(errorMessage(err));
      setSelected([]);
    }
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => void open()} className={btnGhost}>
        {count === null ? "Pieces" : `Pieces (${count})`}
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!selected) return;
        setSaving(true);
        try {
          await adminApi.updateGalleryItem(item.id, { productIds: selected });
          setCount(selected.length);
          setEditing(false);
        } catch (err) {
          onError(errorMessage(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <p className={labelCls}>Pieces in this shot</p>
      {selected === null ? (
        <p className="text-[11px] leading-5 text-faint">Loading…</p>
      ) : products.length === 0 ? (
        <p className="text-[11px] leading-5 text-faint">
          No products to link yet.
        </p>
      ) : (
        <ul className="max-h-40 overflow-y-auto rounded-[var(--radius-control)] border border-line p-2">
          {products.map((product) => (
            <li key={product.id}>
              <label className="flex items-center gap-2 py-0.5 text-[12px] text-ink">
                <input
                  type="checkbox"
                  checked={selected.includes(product.id)}
                  onChange={(e) =>
                    setSelected((current) =>
                      e.target.checked
                        ? [...(current ?? []), product.id]
                        : (current ?? []).filter((id) => id !== product.id),
                    )
                  }
                  className={checkboxCls}
                />
                <span className="truncate">{product.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || selected === null}
          className={btnGhost}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className={btnGhost}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
