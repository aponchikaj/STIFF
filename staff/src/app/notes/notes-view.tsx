"use client";

import { useMemo, useState } from "react";
import { staffNotesApi, type StaffNote } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { IconPlus } from "@/components/icons";
import {
  Banner,
  BottomSheet,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  SaveStatus,
  SearchInput,
  btnGhostSm,
  btnOutline,
  btnSolid,
  btnSolidSm,
  chipSm,
  inputCls,
  pagePad,
  textareaCls,
} from "@/components/ui";

export function NotesView() {
  const notes = useAsync(() => staffNotesApi.list(), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileEditor, setMobileEditor] = useState(false);
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);

  const sorted = useMemo(() => {
    const rows = [...(notes.data ?? [])];
    rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return +new Date(b.updatedAt) - +new Date(a.updatedAt);
    });
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (note) =>
        note.title.toLowerCase().includes(q) ||
        note.body.toLowerCase().includes(q),
    );
  }, [notes.data, query]);

  const active =
    notes.data?.find((n) => n.id === activeId) ??
    (mobileEditor ? null : (sorted[0] ?? null));

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    try {
      const created = await staffNotesApi.create({
        title: String(data.get("title") ?? ""),
        body: "",
      });
      notes.setData((prev) => [created, ...(prev ?? [])]);
      setActiveId(created.id);
      setMobileEditor(true);
      setComposing(false);
      form.reset();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function save(note: StaffNote, patch: Partial<StaffNote>) {
    setError(null);
    try {
      const updated = await staffNotesApi.update(note.id, {
        title: patch.title,
        body: patch.body,
        pinned: patch.pinned,
      });
      notes.setData((prev) =>
        (prev ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await staffNotesApi.remove(id);
      notes.setData((prev) => (prev ?? []).filter((item) => item.id !== id));
      if (activeId === id) setActiveId(null);
      setMobileEditor(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (notes.loading) return <Loading label="Notes" />;
  if (notes.error)
    return <ErrorNote message={notes.error} onRetry={notes.reload} />;

  const list = (
    <aside className="flex min-h-0 flex-1 flex-col md:w-80 md:shrink-0 md:flex-none md:border-r md:border-subtle">
      <div className={`${pagePad} py-5 md:px-5 md:py-6`}>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          Private
        </p>
        <h1 className="mt-1 text-3xl uppercase tracking-tight">Notes</h1>
        <div className="mt-5">
          <SearchInput
            id="note-search"
            value={query}
            onChange={setQuery}
            placeholder="Search notes"
          />
        </div>
        <div className="mt-3 hidden md:block">
          <form onSubmit={(e) => void create(e)} className="flex flex-col gap-3">
            <Field id="note-title" label="New note">
              <input id="note-title" name="title" required className={inputCls} />
            </Field>
            <button type="submit" className={`${btnSolidSm} w-full`}>
              Add
            </button>
          </form>
        </div>
        <div className="mt-3">
          <Banner message={error ?? ""} tone="error" />
        </div>
      </div>
      {sorted.length === 0 ? (
        <EmptyState
          title={query ? "No matches" : "No notes yet"}
          body={
            query
              ? "Try a different search."
              : "Add a title. Notes stay on this account only."
          }
        />
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto border-t border-subtle pb-20 md:pb-0">
          {sorted.map((note) => {
            const snippet = note.body.replace(/\s+/g, " ").trim();
            const selected = active?.id === note.id;
            return (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(note.id);
                    setMobileEditor(true);
                  }}
                  className={`flex min-h-16 w-full flex-col gap-1 px-4 py-4 text-left transition-colors duration-150 sm:px-5 ${
                    selected
                      ? "bg-foreground text-background"
                      : "hover:bg-surface"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">
                      {note.title}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] uppercase tracking-[0.15em] ${
                        selected ? "opacity-80" : "text-muted"
                      }`}
                    >
                      {note.pinned ? "Pin · " : ""}
                      {formatRelative(note.updatedAt)}
                    </span>
                  </span>
                  <span
                    className={`line-clamp-1 text-sm ${
                      selected ? "opacity-80" : "text-muted"
                    }`}
                  >
                    {snippet || "Empty"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );

  const editor = active ? (
    <NoteEditor
      key={active.id}
      note={active}
      onSave={save}
      onRemove={remove}
      onBack={() => setMobileEditor(false)}
    />
  ) : (
    <p className={`${pagePad} py-10 text-sm text-muted`}>
      Create a note to begin.
    </p>
  );

  return (
    <section className="relative flex min-h-0 flex-1 flex-col md:flex-row">
      <div
        className={
          mobileEditor
            ? "hidden min-h-0 md:flex md:flex-col"
            : "flex min-h-0 flex-1 flex-col md:flex-none"
        }
      >
        {list}
      </div>
      <div
        className={`min-h-0 min-w-0 flex-1 flex-col ${mobileEditor ? "flex" : "hidden md:flex"}`}
      >
        {editor}
      </div>

      {!mobileEditor && (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className={`${btnSolid} fixed right-4 z-30 gap-2 md:hidden`}
          style={{
            bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
          }}
        >
          <IconPlus className="size-4" />
          Add
        </button>
      )}

      {composing && (
        <BottomSheet
          open={composing}
          title="New note"
          onClose={() => setComposing(false)}
        >
          <form onSubmit={(e) => void create(e)} className="flex flex-col gap-4">
            <Field id="note-title-mobile" label="Title">
              <input
                id="note-title-mobile"
                name="title"
                required
                autoFocus
                className={inputCls}
              />
            </Field>
            <button type="submit" className={`${btnSolidSm} w-full`}>
              Add
            </button>
          </form>
        </BottomSheet>
      )}
    </section>
  );
}

function NoteEditor({
  note,
  onSave,
  onRemove,
  onBack,
}: {
  note: StaffNote;
  onSave: (note: StaffNote, patch: Partial<StaffNote>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onBack: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function persist(patch: Partial<StaffNote>) {
    setSaveState("saving");
    try {
      await onSave(note, patch);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`flex items-center gap-3 border-b border-subtle py-3 ${pagePad}`}>
        <button
          type="button"
          className={`${btnGhostSm} -ml-2 md:hidden`}
          onClick={onBack}
        >
          All notes
        </button>
        <div className="ml-auto">
          <SaveStatus state={saveState} />
        </div>
      </div>
      <div className={`flex min-h-0 flex-1 flex-col gap-4 py-5 ${pagePad}`}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== note.title) {
              void persist({ title: title.trim() });
            }
          }}
          aria-label="Note title"
          className="border-b border-subtle bg-transparent pb-3 text-2xl uppercase tracking-tight focus:border-foreground focus-visible:outline-none sm:text-3xl"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => {
            if (body !== note.body) void persist({ body });
          }}
          aria-label="Note body"
          className={`${textareaCls} min-h-48 flex-1`}
          placeholder="Write…"
        />
      </div>
      <div
        className={`flex flex-wrap gap-2 border-t border-subtle bg-background py-3 ${pagePad}`}
      >
        <button
          type="button"
          className={btnOutline}
          onClick={() => void persist({ pinned: !note.pinned })}
        >
          {note.pinned ? "Unpin" : "Pin"}
        </button>
        {confirmDelete ? (
          <button
            type="button"
            className={chipSm}
            onClick={() => void onRemove(note.id)}
          >
            Sure?
          </button>
        ) : (
          <button
            type="button"
            className={btnGhostSm}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
