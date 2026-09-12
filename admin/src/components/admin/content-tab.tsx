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
  Badge,
  btnGhost,
  btnIcon,
  btnPrimarySm,
  btnSecondarySm,
  chipCls,
  ErrorNote,
  Field,
  inputCls,
  labelCls,
  Loading,
  Note,
  Panel,
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
    <div className="flex flex-col gap-5">
      {groups.map((group) =>
        group.blocks.map((block) => (
          <BlockEditor
            key={block.key}
            group={group.name}
            block={block}
            initial={saved[block.key] ?? {}}
          />
        )),
      )}
    </div>
  );
}

function BlockEditor({
  group,
  block,
  initial,
}: {
  group: string;
  block: ContentBlock;
  initial: Values;
}) {
  const { refreshFeatures } = useSession();
  const [values, setValues] = useState<Values>(() => seed(block, initial));
  const [baseline, setBaseline] = useState<Values>(() => seed(block, initial));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);

  function set(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setNote(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const snapshot = values;
    try {
      await adminApi.updateContent(block.key, values);
      // The shop switch changes the whole site chrome, so refresh it here.
      if (block.key === "features") await refreshFeatures();
      setBaseline(snapshot);
      setNote("Saved. Live on the site now.");
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <Panel
        eyebrow={group}
        title={block.label}
        className={dirty ? "border-caution/40" : ""}
        aside={
          <>
            {dirty && <Badge tone="caution">Unsaved</Badge>}
            <button type="submit" disabled={busy} className={btnPrimarySm}>
              {busy ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {block.description && (
          <p className="mb-4 max-w-prose text-[13px] leading-6 text-muted">
            {block.description}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {block.fields.map((field) => (
            <div key={field.key} className={spanFor(field)}>
              <FieldEditor
                block={block}
                field={field}
                value={values[field.key]}
                onChange={(next) => set(field.key, next)}
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Note>{note}</Note>
        </div>
      </Panel>
    </form>
  );
}

/** Short text sits two to a row; anything tall takes the full width. */
function spanFor(field: ContentField): string {
  return field.type === "text" ? "sm:col-span-1" : "sm:col-span-2";
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
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-control)] border border-line bg-raised px-4 py-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink">{field.label}</p>
          {field.hint && (
            <p className="mt-0.5 text-[11px] leading-5 text-faint">
              {field.hint}
            </p>
          )}
        </div>
        <div className="flex gap-1.5">
          {[true, false].map((state) => (
            <button
              key={String(state)}
              type="button"
              aria-pressed={on === state}
              onClick={() => onChange(state)}
              className={chipCls(on === state)}
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
      <fieldset className="rounded-[var(--radius-control)] border border-line px-4 pb-4 pt-3">
        <legend className={`${labelCls} px-1`}>{field.label}</legend>
        {field.hint && (
          <p className="text-[11px] leading-5 text-faint">{field.hint}</p>
        )}

        {items.map((item, i) => (
          <div key={i} className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="tnum text-[11px] font-semibold tracking-[0.1em] text-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className={`${btnIcon} disabled:opacity-40`}
                  disabled={i === 0}
                  onClick={() => onChange(move(items, i, i - 1))}
                  aria-label={`Move ${item.title || "item"} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={`${btnIcon} disabled:opacity-40`}
                  disabled={i === items.length - 1}
                  onClick={() => onChange(move(items, i, i + 1))}
                  aria-label={`Move ${item.title || "item"} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={`${btnGhost} ml-1.5`}
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
          className={`${btnSecondarySm} mt-3`}
          onClick={() => onChange([...items, { title: "", body: "" }])}
        >
          Add item
        </button>
      </fieldset>
    );
  }

  const text = typeof value === "string" ? value : "";
  return (
    <Field id={id} label={field.label} hint={field.hint}>
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
