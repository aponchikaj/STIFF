"use client";

import { useState } from "react";
import { staffNotesApi, type StaffNote } from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import {
  btnGhostSm,
  btnOutline,
  btnSolidSm,
  ErrorNote,
  Field,
  inputCls,
  Loading,
  textareaCls,
} from "@/components/ui";

export function NotesView() {
  const notes = useAsync(() => staffNotesApi.list(), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = notes.data?.find((n) => n.id === activeId) ?? notes.data?.[0] ?? null;

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
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await staffNotesApi.remove(id);
      notes.setData((prev) => (prev ?? []).filter((item) => item.id !== id));
      if (activeId === id) setActiveId(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (notes.loading) return <Loading label="Notes" />;
  if (notes.error) return <ErrorNote message={notes.error} />;

  return (
    <section className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="border-b border-subtle md:w-72 md:border-b-0 md:border-r">
        <div className="px-5 py-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Private
          </p>
          <h1 className="mt-1 text-3xl uppercase tracking-tight">Notes</h1>
          <form onSubmit={(e) => void create(e)} className="mt-6 flex flex-col gap-3">
            <Field id="note-title" label="New note">
              <input id="note-title" name="title" required className={inputCls} />
            </Field>
            <button type="submit" className={btnSolidSm}>
              Add
            </button>
          </form>
          {error && <p className="mt-3 text-xs text-muted">{error}</p>}
        </div>
        <ul className="border-t border-subtle">
          {(notes.data ?? []).map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => setActiveId(note.id)}
                className={`flex w-full items-center justify-between px-5 py-4 text-left text-sm transition-colors ${
                  active?.id === note.id
                    ? "bg-foreground text-background"
                    : "hover:bg-surface"
                }`}
              >
                <span className="truncate">{note.title}</span>
                {note.pinned && (
                  <span className="ml-3 text-[10px] uppercase tracking-[0.15em]">
                    Pin
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col px-5 py-8">
        {!active && <p className="text-sm text-muted">Create a note to begin.</p>}
        {active && (
          <NoteEditor
            key={active.id}
            note={active}
            onSave={save}
            onRemove={remove}
          />
        )}
      </div>
    </section>
  );
}

function NoteEditor({
  note,
  onSave,
  onRemove,
}: {
  note: StaffNote;
  onSave: (note: StaffNote, patch: Partial<StaffNote>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title.trim() && title !== note.title) {
            void onSave(note, { title: title.trim() });
          }
        }}
        className="border-b border-subtle bg-transparent pb-3 text-3xl uppercase tracking-tight focus:border-foreground focus-visible:outline-none"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => {
          if (body !== note.body) void onSave(note, { body });
        }}
        className={`${textareaCls} min-h-80 flex-1`}
        placeholder="Write…"
      />
      <div className="flex gap-3">
        <button
          type="button"
          className={btnOutline}
          onClick={() => void onSave(note, { pinned: !note.pinned })}
        >
          {note.pinned ? "Unpin" : "Pin"}
        </button>
        <button
          type="button"
          className={btnGhostSm}
          onClick={() => void onRemove(note.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
