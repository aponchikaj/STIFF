"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi, contentApi } from "@/lib/api";
import type {
  ContentBlock,
  ContentField,
  ContentListItem,
  SiteContent,
} from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { useSession } from "../providers";
import {
  btnGhostSm,
  btnSolidSm,
  ErrorNote,
  Field,
  inputCls,
  labelCls,
  Loading,
  textareaCls,
} from "../ui";

type Values = Record<string, unknown>;

/**
 * Renders itself from the backend content registry, so a new editable block
 * needs no change here — add it to `content.registry.ts` and it appears.
 */
export function ContentTab() {
  const [blocks, setBlocks] = useState<ContentBlock[] | null>(null);
  const [saved, setSaved] = useState<Record<string, Values>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [catalog, all] = await Promise.all([
        contentApi.getContentCatalog(),
        contentApi.getAllContent(),
      ]);
      setBlocks(catalog.blocks);
      setSaved(
        Object.fromEntries(all.map((row: SiteContent) => [row.key, row.value])),
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    if (!blocks) return [];
    const order: string[] = [];
    const byGroup = new Map<string, ContentBlock[]>();
    for (const block of blocks) {
      if (!byGroup.has(block.group)) {
        byGroup.set(block.group, []);
        order.push(block.group);
      }
      byGroup.get(block.group)!.push(block);
    }
    return order.map((name) => ({ name, blocks: byGroup.get(name)! }));
  }, [blocks]);

  if (error && !blocks) return <ErrorNote message={error} />;
  if (!blocks) return <Loading label="Loading content" />;

  return (
    <div className="flex flex-col gap-14">
      {groups.map((group) => (
        <section key={group.name} className="flex flex-col gap-8">
          <h2 className="border-b border-subtle pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {group.name}
          </h2>
          <div className="grid gap-10 lg:grid-cols-2">
            {group.blocks.map((block) => (
              <BlockEditor
                key={block.key}
                block={block}
                initial={saved[block.key] ?? {}}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BlockEditor({
  block,
  initial,
}: {
  block: ContentBlock;
  initial: Values;
}) {
  const { refreshFeatures } = useSession();
  const [values, setValues] = useState<Values>(() => seed(block, initial));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function set(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setNote(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      await adminApi.updateContent(block.key, values);
      // The shop switch changes the whole site chrome, so refresh it here.
      if (block.key === "features") await refreshFeatures();
      setNote("Saved. Live on the site now.");
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div>
        <p className={labelCls}>{block.label}</p>
        {block.description && (
          <p className="mt-1 text-sm text-muted">{block.description}</p>
        )}
      </div>

      {block.fields.map((field) => (
        <FieldEditor
          key={field.key}
          block={block}
          field={field}
          value={values[field.key]}
          onChange={(next) => set(field.key, next)}
        />
      ))}

      <button
        type="submit"
        disabled={busy}
        className={`${btnSolidSm} self-start`}
      >
        {busy ? "Saving…" : "Save"}
      </button>
      <p aria-live="polite" className="min-h-4 text-xs text-muted">
        {note}
      </p>
    </form>
  );
}

function FieldEditor({
  block,
  field,
  value,
  onChange,
}: {
  block: ContentBlock;
  field: ContentField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const id = `${block.key}-${field.key}`;

  if (field.type === "boolean") {
    const on = value === true;
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 border border-subtle p-4">
        <div>
          <p className="text-sm font-medium">{field.label}</p>
          {field.hint && <p className="mt-1 text-xs text-muted">{field.hint}</p>}
        </div>
        <div className="flex gap-1.5">
          {[true, false].map((state) => (
            <button
              key={String(state)}
              type="button"
              aria-pressed={on === state}
              onClick={() => onChange(state)}
              className={`flex h-9 items-center rounded-[2px] px-4 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
                on === state
                  ? "bg-foreground text-background"
                  : "border border-subtle text-muted hover:border-foreground hover:text-foreground"
              }`}
            >
              {state ? "On" : "Off"}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "list") {
    const items = Array.isArray(value) ? (value as ContentListItem[]) : [];
    return (
      <fieldset className="flex flex-col gap-3 border border-subtle p-4">
        <legend className="px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          {field.label}
        </legend>
        {field.hint && <p className="text-xs text-muted">{field.hint}</p>}

        {items.map((item, i) => (
          <div key={i} className="flex flex-col gap-2 border-t border-subtle pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] tracking-[0.2em] text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={btnGhostSm}
                  disabled={i === 0}
                  onClick={() => onChange(move(items, i, i - 1))}
                  aria-label={`Move ${item.title || "item"} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={btnGhostSm}
                  disabled={i === items.length - 1}
                  onClick={() => onChange(move(items, i, i + 1))}
                  aria-label={`Move ${item.title || "item"} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={btnGhostSm}
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  aria-label={`Remove ${item.title || "item"}`}
                >
                  Remove
                </button>
              </div>
            </div>
            <input
              aria-label={`${field.label} ${i + 1} title`}
              value={item.title}
              placeholder="Title"
              className={inputCls}
              onChange={(e) =>
                onChange(patch(items, i, { title: e.target.value }))
              }
            />
            <textarea
              aria-label={`${field.label} ${i + 1} body`}
              value={item.body}
              placeholder="Body"
              rows={3}
              className={textareaCls}
              onChange={(e) =>
                onChange(patch(items, i, { body: e.target.value }))
              }
            />
          </div>
        ))}

        <button
          type="button"
          className={`${btnGhostSm} self-start`}
          onClick={() => onChange([...items, { title: "", body: "" }])}
        >
          Add item
        </button>
      </fieldset>
    );
  }

  const text = typeof value === "string" ? value : "";
  return (
    <Field id={id} label={field.label}>
      {field.type === "textarea" ? (
        <textarea
          id={id}
          value={text}
          rows={5}
          maxLength={field.maxLength}
          className={textareaCls}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          value={text}
          maxLength={field.maxLength}
          className={inputCls}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

/** Saved values win; anything unsaved starts from the registry default. */
function seed(block: ContentBlock, initial: Values): Values {
  const out: Values = {};
  for (const field of block.fields) {
    out[field.key] = field.key in initial ? initial[field.key] : field.default;
  }
  return out;
}

function patch(
  items: ContentListItem[],
  index: number,
  next: Partial<ContentListItem>,
): ContentListItem[] {
  return items.map((item, i) => (i === index ? { ...item, ...next } : item));
}

function move(
  items: ContentListItem[],
  from: number,
  to: number,
): ContentListItem[] {
  if (to < 0 || to >= items.length) return items;
  const copy = [...items];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}
