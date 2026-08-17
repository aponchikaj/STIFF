"use client";

import { useState } from "react";
import { staffNotesApi, type StaffNote } from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import {
  Banner,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  btnGhostSm,
  btnOutline,
  btnSolidSm,
  inputCls,
  pagePad,
  textareaCls,
} from "@/components/ui";

export function NotesView() {
  const notes = useAsync(() => staffNotesApi.list(), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileEditor, setMobileEditor] = useState(false);
  const active =
    notes.data?.find((n) => n.id === activeId) ?? notes.data?.[0] ?? null;

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
      setMobileEditor(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (notes.loading) return <Loading label="Notes" />;
  if (notes.error) return <ErrorNote message={notes.error} onRetry={notes.reload} />;

  const list = (
    <aside className="flex min-h-0 flex-col border-subtle md:w-72 md:shrink-0 md:border-r">
      <div className={`${pagePad} py-6 md:px-5`}>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          Private
        </p>
        <h1 className="mt-1 text-3xl uppercase tracking-tight">Notes</h1>
        <form onSubmit={(e) => void create(e)} className="mt-6 flex flex-col gap-3">
          <Field id="note-title" label="New note">
            <input id="note-title" name="title" required className={inputCls} />
          </Field>
          <button type="submit" className={`${btnSolidSm} w-full`}>
            Add
          </button>
        </form>
        <div className="mt-3">
          <Banner message={error ?? ""} tone="error" />
        </div>
      </div>
      {(notes.data ?? []).length === 0 ? (
        <EmptyState
          title="No notes yet"
          body="Add a title above. Notes stay on this account only."
        />
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto border-t border-subtle">
          {(notes.data ?? []).map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => {
                  setActiveId(note.id);
                  setMobileEditor(true);
                }}
                className={`flex min-h-14 w-full items-center justify-between px-4 py-4 text-left text-sm transition-colors duration-150 sm:px-5 ${
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
    <section className="flex min-h-0 flex-1 flex-col md:flex-row">
      <div className={mobileEditor ? "hidden md:flex md:min-h-0 md:flex-col" : "flex min-h-0 flex-1 flex-col md:flex-none"}>
        {list}
      </div>
      <div
        className={`min-h-0 min-w-0 flex-1 flex-col ${mobileEditor ? "flex" : "hidden md:flex"}`}
      >
        {editor}
      </div>
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

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-4 py-6 ${pagePad}`}>
      <button
        type="button"
        className={`${btnGhostSm} -ml-2 md:hidden`}
        onClick={onBack}
      >
        All notes
      </button>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title.trim() && title !== note.title) {
            void onSave(note, { title: title.trim() });
          }
        }}
        aria-label="Note title"
        className="border-b border-subtle bg-transparent pb-3 text-2xl uppercase tracking-tight focus:border-foreground focus-visible:outline-none sm:text-3xl"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => {
          if (body !== note.body) void onSave(note, { body });
        }}
        aria-label="Note body"
        className={`${textareaCls} min-h-64 flex-1`}
        placeholder="Write…"
      />
      <div className="flex flex-wrap gap-2">
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
