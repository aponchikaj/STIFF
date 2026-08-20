"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import type { GalleryTagWithCount, TagKind } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { btnGhostSm, btnSolidSm, inputCls, labelCls, selectCls } from "../ui";

/**
 * The tag vocabulary.
 *
 * Kept short on purpose: the filter bar is only useful while every chip is a
 * real way through the archive. Twenty overlapping themes and it becomes a
 * wall of chips nobody reads, which is worse than the sort order it replaced.
 */

const KINDS: { value: TagKind; label: string }[] = [
  { value: "season", label: "Season" },
  { value: "location", label: "Place" },
  { value: "theme", label: "Theme" },
];

export function GalleryTags({
  tags,
  onChanged,
  onError,
}: {
  tags: GalleryTagWithCount[];
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<TagKind>("season");
  const [saving, setSaving] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    try {
      await adminApi.createGalleryTag({ label: label.trim(), kind });
      setLabel("");
      onChanged();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <p className={labelCls}>Tags ({tags.length})</p>

      <form
        onSubmit={(e) => void create(e)}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-2">
          <span className={labelCls}>Label</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            placeholder="Summer"
            className={`${inputCls} h-10 w-48 text-xs`}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={labelCls}>Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as TagKind)}
            className={selectCls}
          >
            {KINDS.map((one) => (
              <option key={one.value} value={one.value}>
                {one.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={saving || !label.trim()}
          className={btnSolidSm}
        >
          {saving ? "Adding…" : "Add tag"}
        </button>
      </form>

      {tags.length === 0 ? (
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted/70">
          No tags yet. The filter bar stays hidden until there is at least one.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center gap-2 border border-subtle px-3 py-1.5"
            >
              <span className="text-[11px] uppercase tracking-[0.1em] text-foreground">
                {tag.label}
              </span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-muted">
                {KINDS.find((one) => one.value === tag.kind)?.label ?? tag.kind}
                {" · "}
                <span className="tabular-nums">{tag.count}</span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (
                    !confirm(
                      `Delete "${tag.label}"? It comes off ${tag.count} shot${
                        tag.count === 1 ? "" : "s"
                      }. No photographs are deleted.`,
                    )
                  ) {
                    return;
                  }
                  try {
                    await adminApi.deleteGalleryTag(tag.id);
                    onChanged();
                  } catch (err) {
                    onError(errorMessage(err));
                  }
                }}
                aria-label={`Delete the ${tag.label} tag`}
                className={btnGhostSm}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
