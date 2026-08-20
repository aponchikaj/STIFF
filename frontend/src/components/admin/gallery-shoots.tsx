"use client";

import { useState } from "react";
import { adminApi, galleryApi } from "@/lib/api";
import type {
  CreditInput,
  CreditRole,
  GalleryItem,
  ShootSummary,
} from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import { imageUrl } from "@/lib/image";
import {
  btnGhostSm,
  btnOutline,
  btnSolidSm,
  inputCls,
  labelCls,
  Loading,
  selectCls,
} from "../ui";

/**
 * Shoots, and the people in them.
 *
 * A shoot is assembled after the files are already up: the uploader drops a
 * folder, and this is where that folder becomes a day, a place and a set of
 * credits. Unpublished shoots exist for exactly that gap — the page is
 * reachable by link while it is being written and stays out of the sitemap
 * until it is not a draft.
 */

const ROLES: { value: CreditRole; label: string }[] = [
  { value: "photographer", label: "Photography" },
  { value: "model", label: "Model" },
  { value: "stylist", label: "Styling" },
  { value: "makeup", label: "Make-up" },
  { value: "hair", label: "Hair" },
  { value: "art_direction", label: "Art direction" },
  { value: "set_design", label: "Set design" },
  { value: "retouch", label: "Retouching" },
  { value: "assistant", label: "Assistant" },
  { value: "location", label: "Location" },
];

interface ShootDraft {
  id: string | null;
  title: string;
  shotOn: string;
  location: string;
  description: string;
  isPublished: boolean;
  itemIds: string[];
  credits: CreditInput[];
}

function emptyDraft(): ShootDraft {
  return {
    id: null,
    title: "",
    shotOn: "",
    location: "",
    description: "",
    isPublished: true,
    itemIds: [],
    credits: [],
  };
}

export function GalleryShoots({
  onError,
}: {
  onError: (message: string) => void;
}) {
  const { data: shoots, loading, reload } = useAsync(
    () => galleryApi.listShoots(),
    [],
  );
  const [draft, setDraft] = useState<ShootDraft | null>(null);

  async function edit(shoot: ShootSummary) {
    try {
      const detail = await galleryApi.getShoot(shoot.slug);
      setDraft({
        id: detail.id,
        title: detail.title,
        shotOn: detail.shotOn ?? "",
        location: detail.location ?? "",
        description: detail.description ?? "",
        isPublished: detail.isPublished,
        itemIds: detail.items.map((item) => item.id),
        credits: detail.credits.map((credit) => ({
          role: credit.role,
          name: credit.name,
          instagram: credit.instagram ?? "",
          url: credit.url ?? "",
        })),
      });
    } catch (err) {
      onError(errorMessage(err));
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className={labelCls}>Shoots ({shoots?.length ?? 0})</p>
        {draft === null && (
          <button
            type="button"
            onClick={() => setDraft(emptyDraft())}
            className={btnSolidSm}
          >
            New shoot
          </button>
        )}
      </div>

      {loading && <Loading label="Loading shoots" />}

      {draft && (
        <ShootForm
          draft={draft}
          onChange={setDraft}
          onDone={() => {
            setDraft(null);
            reload();
          }}
          onCancel={() => setDraft(null)}
          onError={onError}
        />
      )}

      {shoots && shoots.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {shoots.map((shoot) => (
            <li key={shoot.id} className="flex flex-col gap-1">
              {shoot.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl(shoot.cover.imageUrl, 320, "tile", shoot.cover.rotation)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full rounded-[2px] bg-surface object-cover"
                />
              ) : (
                <div className="aspect-square w-full rounded-[2px] bg-surface" />
              )}
              <p className="truncate text-[11px] uppercase tracking-tight text-foreground">
                {shoot.title}
              </p>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted">
                {shoot.shotCount} shot{shoot.shotCount === 1 ? "" : "s"}
                {shoot.isPublished ? "" : " · draft"}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void edit(shoot)}
                  className={btnGhostSm}
                >
                  Edit
                </button>
                <a
                  href={`/gallery/shoot/${shoot.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={btnGhostSm}
                >
                  View
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Delete "${shoot.title}"? Its ${shoot.shotCount} shots go back to the ungrouped archive — no photographs are deleted.`,
                      )
                    ) {
                      return;
                    }
                    try {
                      await adminApi.deleteShoot(shoot.id);
                      reload();
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
      )}
    </section>
  );
}

function ShootForm({
  draft,
  onChange,
  onDone,
  onCancel,
  onError,
}: {
  draft: ShootDraft;
  onChange: (draft: ShootDraft) => void;
  onDone: () => void;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  // Shots already in this shoot plus everything unfiled — the two sets the
  // picker needs, and the only ones it may move between.
  const { data: pool } = useAsync(async () => {
    const [ungrouped, mine] = await Promise.all([
      adminApi.listUngroupedShots(),
      draft.id
        ? galleryApi
            .listShoots()
            .then((all) => all.find((one) => one.id === draft.id))
            .then((found) =>
              found ? galleryApi.getShoot(found.slug).then((d) => d.items) : [],
            )
        : Promise.resolve<GalleryItem[]>([]),
    ]);
    const seen = new Set(mine.map((item) => item.id));
    return [...mine, ...ungrouped.filter((item) => !seen.has(item.id))];
  }, [draft.id]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const body = {
        title: draft.title.trim(),
        // Empty strings would be stored as empty strings; the column means
        // "not recorded", which is null.
        shotOn: draft.shotOn || undefined,
        location: draft.location.trim() || undefined,
        description: draft.description.trim() || undefined,
        isPublished: draft.isPublished,
        itemIds: draft.itemIds,
        credits: draft.credits
          .filter((credit) => credit.name.trim())
          .map((credit) => ({
            role: credit.role,
            name: credit.name.trim(),
            instagram: credit.instagram?.trim() || undefined,
            url: credit.url?.trim() || undefined,
          })),
      };
      if (draft.id) await adminApi.updateShoot(draft.id, body);
      else await adminApi.createShoot(body);
      onDone();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-5 border border-foreground p-4"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className={labelCls}>Title</span>
          <input
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            maxLength={160}
            required
            placeholder="Spring, Vake"
            className={`${inputCls} h-10 text-xs`}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={labelCls}>Date</span>
          <input
            type="date"
            value={draft.shotOn}
            onChange={(e) => onChange({ ...draft, shotOn: e.target.value })}
            className={`${inputCls} h-10 text-xs`}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={labelCls}>Location</span>
          <input
            value={draft.location}
            onChange={(e) => onChange({ ...draft, location: e.target.value })}
            maxLength={160}
            placeholder="Tbilisi"
            className={`${inputCls} h-10 text-xs`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className={labelCls}>Description</span>
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          maxLength={4000}
          rows={3}
          className="w-full rounded-[2px] border border-subtle bg-transparent px-3 py-2 text-xs text-foreground focus:border-foreground focus-visible:outline-none"
        />
      </label>

      <label className="flex items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={draft.isPublished}
          onChange={(e) => onChange({ ...draft, isPublished: e.target.checked })}
          className="size-3.5"
        />
        <span>
          Published — unticked it stays reachable by link but out of the index
        </span>
      </label>

      {/* ---- Credits ---- */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className={labelCls}>Credits</p>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...draft,
                credits: [
                  ...draft.credits,
                  { role: "photographer", name: "", instagram: "", url: "" },
                ],
              })
            }
            className={btnGhostSm}
          >
            Add person
          </button>
        </div>
        {draft.credits.length === 0 ? (
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted/70">
            Nobody credited yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {draft.credits.map((credit, index) => (
              <li key={index} className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr_auto]">
                <select
                  value={credit.role}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      credits: draft.credits.map((one, i) =>
                        i === index
                          ? { ...one, role: e.target.value as CreditRole }
                          : one,
                      ),
                    })
                  }
                  aria-label="Role"
                  className={selectCls}
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <input
                  value={credit.name}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      credits: draft.credits.map((one, i) =>
                        i === index ? { ...one, name: e.target.value } : one,
                      ),
                    })
                  }
                  placeholder="Name"
                  aria-label="Name"
                  maxLength={120}
                  className={`${inputCls} h-10 text-xs`}
                />
                <input
                  value={credit.instagram ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      credits: draft.credits.map((one, i) =>
                        i === index
                          ? { ...one, instagram: e.target.value }
                          : one,
                      ),
                    })
                  }
                  placeholder="@instagram (optional)"
                  aria-label="Instagram handle"
                  maxLength={60}
                  className={`${inputCls} h-10 text-xs`}
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      credits: draft.credits.filter((_, i) => i !== index),
                    })
                  }
                  aria-label={`Remove ${credit.name || "this credit"}`}
                  className={btnGhostSm}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- The roll ---- */}
      <div className="flex flex-col gap-2">
        <p className={labelCls}>
          Shots ({draft.itemIds.length})
        </p>
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted/70">
          This shoot&apos;s own shots, plus everything not yet filed.
        </p>
        {!pool ? (
          <Loading label="Loading shots" />
        ) : (
          <ul className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto border border-subtle p-2 sm:grid-cols-8">
            {pool.map((item) => {
              const on = draft.itemIds.includes(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    title={item.title}
                    onClick={() =>
                      onChange({
                        ...draft,
                        itemIds: on
                          ? draft.itemIds.filter((id) => id !== item.id)
                          : [...draft.itemIds, item.id],
                      })
                    }
                    className={`block w-full rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
                      on ? "ring-2 ring-foreground" : "opacity-50 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl(item.imageUrl, 160, "tile", item.rotation)}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full bg-surface object-cover"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className={btnSolidSm}>
          {saving ? "Saving…" : draft.id ? "Save shoot" : "Create shoot"}
        </button>
        <button type="button" onClick={onCancel} className={btnOutline}>
          Cancel
        </button>
      </div>
    </form>
  );
}
