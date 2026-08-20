"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi, galleryApi } from "@/lib/api";
import type {
  GalleryItem,
  GalleryShoot,
  GalleryTagWithCount,
  Product,
  ProductTagInput,
} from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { asRotation, imageUrl } from "@/lib/image";
import {
  btnGhostSm,
  btnSolidSm,
  labelCls,
  selectCls,
  Spinner,
} from "../ui";

/**
 * Everything a shot belongs to and everything in it, in one panel.
 *
 * Split across five little inline forms this was unusable: filing a shoot
 * meant opening the same card five times. It is one editor because it is one
 * decision — this photograph, from that day, showing these pieces.
 *
 * The pins are the part that has to be direct. A coordinate pair typed into
 * two number fields is not something anyone will do fifteen times, so a pin is
 * placed by clicking the photograph where the piece is.
 */

interface Draft {
  shootId: string | null;
  tagIds: string[];
  pins: ProductTagInput[];
}

export function ShotEditor({
  item,
  products,
  shoots,
  tags,
  onSaved,
  onClose,
  onError,
}: {
  item: GalleryItem;
  products: Product[];
  shoots: GalleryShoot[];
  tags: GalleryTagWithCount[];
  onSaved: () => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  /** The piece the next click on the photograph will pin. */
  const [placing, setPlacing] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  // The links are not in the archive listing — it is fifty shots a page and
  // nothing else needs them — so they are fetched when the editor opens.
  useEffect(() => {
    let cancelled = false;
    void galleryApi
      .getGalleryItem(item.slug)
      .then((detail) => {
        if (cancelled) return;
        setDraft({
          shootId: detail.shootId ?? null,
          tagIds: (detail.tags ?? []).map((tag) => tag.id),
          pins: (detail.products ?? []).map((product) => ({
            productId: product.id,
            ...(product.hotspotX !== null && product.hotspotY !== null
              ? { hotspotX: product.hotspotX, hotspotY: product.hotspotY }
              : {}),
          })),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        onError(errorMessage(err));
        setDraft({ shootId: null, tagIds: [], pins: [] });
      });
    return () => {
      cancelled = true;
    };
    // `onError` is a fresh closure on every parent render; re-fetching the
    // shot because of that would throw away edits in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.slug]);

  function togglePiece(productId: string, on: boolean) {
    setDraft((current) =>
      current === null
        ? current
        : {
            ...current,
            pins: on
              ? [...current.pins, { productId }]
              : current.pins.filter((pin) => pin.productId !== productId),
          },
    );
    if (!on && placing === productId) setPlacing(null);
  }

  function place(event: React.MouseEvent<HTMLDivElement>) {
    if (!placing) return;
    const box = event.currentTarget.getBoundingClientRect();
    // Percentages of the displayed frame — the same space the visitor sees,
    // which is what makes a pin survive every breakpoint.
    const hotspotX = ((event.clientX - box.left) / box.width) * 100;
    const hotspotY = ((event.clientY - box.top) / box.height) * 100;
    setDraft((current) =>
      current === null
        ? current
        : {
            ...current,
            pins: current.pins.map((pin) =>
              pin.productId === placing
                ? {
                    productId: pin.productId,
                    hotspotX: Math.round(hotspotX * 10) / 10,
                    hotspotY: Math.round(hotspotY * 10) / 10,
                  }
                : pin,
            ),
          },
    );
    setPlacing(null);
  }

  function clearPin(productId: string) {
    setDraft((current) =>
      current === null
        ? current
        : {
            ...current,
            pins: current.pins.map((pin) =>
              pin.productId === productId ? { productId } : pin,
            ),
          },
    );
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await adminApi.updateGalleryItem(item.id, {
        shootId: draft.shootId,
        tagIds: draft.tagIds,
        productTags: draft.pins,
      });
      onSaved();
      onClose();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!draft) {
    return (
      <div className="col-span-full flex items-center gap-3 border border-subtle p-4">
        <Spinner className="size-4" />
        <p className="text-[11px] uppercase tracking-[0.15em] text-muted">
          Loading {item.title}
        </p>
      </div>
    );
  }

  const pinnedIds = new Set(draft.pins.map((pin) => pin.productId));
  const placed = draft.pins.filter((pin) => pin.hotspotX !== undefined);

  return (
    <div className="col-span-full flex flex-col gap-5 border border-foreground p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className={labelCls}>Editing {item.title}</p>
        <button type="button" onClick={onClose} className={btnGhostSm}>
          Close
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---- The photograph, and the pins on it ---- */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted">
            {placing
              ? "Click the photograph where that piece is worn"
              : placed.length > 0
                ? `${placed.length} pin${placed.length === 1 ? "" : "s"} placed`
                : "Tick a piece, then hit “Place pin”"}
          </p>
          <div
            ref={frame}
            onClick={place}
            className={`relative mt-2 w-full ${placing ? "cursor-crosshair ring-2 ring-foreground" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(item.imageUrl, 800, "detail", asRotation(item.rotation))}
              alt={item.altText ?? item.title}
              draggable={false}
              className="w-full rounded-[2px] bg-surface"
            />
            {draft.pins.map((pin) =>
              pin.hotspotX === undefined || pin.hotspotY === undefined ? null : (
                <span
                  key={pin.productId}
                  style={{ left: `${pin.hotspotX}%`, top: `${pin.hotspotY}%` }}
                  title={
                    products.find((p) => p.id === pin.productId)?.name ??
                    "Piece"
                  }
                  className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
                />
              ),
            )}
          </div>
        </div>

        {/* ---- What it belongs to, and what is in it ---- */}
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor={`shoot-${item.id}`} className={labelCls}>
              Shoot
            </label>
            <select
              id={`shoot-${item.id}`}
              value={draft.shootId ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, shootId: e.target.value || null })
              }
              className={`${selectCls} mt-2 w-full`}
            >
              <option value="">Not in a shoot</option>
              {shoots.map((shoot) => (
                <option key={shoot.id} value={shoot.id}>
                  {shoot.title}
                  {shoot.isPublished ? "" : " (draft)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className={labelCls}>Tags</p>
            {tags.length === 0 ? (
              <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-muted/70">
                None yet — make some below.
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {tags.map((tag) => (
                  <li key={tag.id}>
                    <label className="flex items-center gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={draft.tagIds.includes(tag.id)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            tagIds: e.target.checked
                              ? [...draft.tagIds, tag.id]
                              : draft.tagIds.filter((id) => id !== tag.id),
                          })
                        }
                        className="size-3.5"
                      />
                      <span>{tag.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className={labelCls}>Pieces worn</p>
            {products.length === 0 ? (
              <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-muted/70">
                No products to link yet.
              </p>
            ) : (
              <ul className="mt-2 max-h-56 overflow-y-auto border border-subtle p-2">
                {products.map((product) => {
                  const pin = draft.pins.find(
                    (one) => one.productId === product.id,
                  );
                  return (
                    <li
                      key={product.id}
                      className="flex items-center gap-2 py-0.5 text-[11px]"
                    >
                      <label className="flex min-w-0 flex-1 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={pinnedIds.has(product.id)}
                          onChange={(e) =>
                            togglePiece(product.id, e.target.checked)
                          }
                          className="size-3.5"
                        />
                        <span className="truncate">{product.name}</span>
                      </label>
                      {pin && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPlacing(
                                placing === product.id ? null : product.id,
                              )
                            }
                            className={btnGhostSm}
                          >
                            {placing === product.id
                              ? "Cancel"
                              : pin.hotspotX === undefined
                                ? "Place pin"
                                : "Move pin"}
                          </button>
                          {pin.hotspotX !== undefined && (
                            <button
                              type="button"
                              onClick={() => clearPin(product.id)}
                              aria-label={`Remove the pin for ${product.name}`}
                              className={btnGhostSm}
                            >
                              ✕
                            </button>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-muted/70">
              A piece without a pin still shows under “Worn here”.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={btnSolidSm}
        >
          {saving ? "Saving…" : "Save shot"}
        </button>
        <button type="button" onClick={onClose} className={btnGhostSm}>
          Cancel
        </button>
      </div>
    </div>
  );
}
