"use client";

import { useMemo, useState } from "react";
import {
  hasPerm,
  staffPeopleApi,
  staffTasksApi,
  type StaffTask,
  type StaffTaskStatus,
} from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import { useStaffSession } from "@/components/providers";
import {
  Banner,
  ErrorNote,
  Field,
  Loading,
  PageHeader,
  btnOutline,
  btnSolidSm,
  inputCls,
  pagePad,
  selectCls,
} from "@/components/ui";

const COLUMNS: { status: StaffTaskStatus; label: string }[] = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Done" },
];

export function TasksView() {
  const { user } = useStaffSession();
  const canViewOthers = hasPerm(user, "tasks.view_others");
  const canAssign = hasPerm(user, "tasks.assign");
  const people = useAsync(
    () =>
      canViewOthers || canAssign
        ? staffPeopleApi.list()
        : Promise.resolve([]),
    [canViewOthers, canAssign],
  );
  const [assigneeId, setAssigneeId] = useState(user?.id ?? "");
  const boardFor = canViewOthers ? assigneeId || user?.id : user?.id;
  const tasks = useAsync(() => staffTasksApi.list(boardFor), [boardFor]);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<StaffTaskStatus, StaffTask[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const task of tasks.data ?? []) map[task.status].push(task);
    return map;
  }, [tasks.data]);

  async function move(task: StaffTask, status: StaffTaskStatus) {
    if (status === task.status) return;
    setError(null);
    try {
      const updated = await staffTasksApi.update(task.id, { status });
      tasks.setData((prev) =>
        (prev ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    try {
      const created = await staffTasksApi.create({
        title: String(data.get("title") ?? ""),
        description: String(data.get("description") ?? ""),
        assigneeId: canAssign
          ? String(data.get("assigneeId") || boardFor)
          : undefined,
      });
      tasks.setData((prev) => [...(prev ?? []), created]);
      form.reset();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await staffTasksApi.remove(id);
      tasks.setData((prev) => (prev ?? []).filter((item) => item.id !== id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (tasks.loading) return <Loading label="Tasks" />;
  if (tasks.error) return <ErrorNote message={tasks.error} onRetry={tasks.reload} />;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        eyebrow="Board"
        title="Tasks"
        description="Your columns. On a phone, swipe sideways across the board."
        actions={
          canViewOthers ? (
            <label className="flex w-full flex-col gap-2 sm:w-56">
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
                Whose board
              </span>
              <select
                className={`${selectCls} w-full`}
                value={assigneeId || user?.id}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                {(people.data ?? []).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.username}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
      />

      <form
        onSubmit={(e) => void create(e)}
        className={`grid gap-3 border-b border-subtle py-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end ${pagePad}`}
      >
        <Field id="task-title" label="Title">
          <input id="task-title" name="title" required className={inputCls} />
        </Field>
        <Field id="task-body" label="Notes" optional>
          <input id="task-body" name="description" className={inputCls} />
        </Field>
        {canAssign && (
          <input type="hidden" name="assigneeId" value={boardFor} />
        )}
        <button type="submit" className={`${btnSolidSm} w-full sm:col-span-2 lg:col-span-1 lg:w-auto`}>
          Add
        </button>
      </form>
      <div className={`${pagePad} pt-3`}>
        <Banner message={error ?? ""} tone="error" />
      </div>

      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-6 pt-4 snap-x snap-mandatory sm:px-6 lg:grid lg:grid-cols-3 lg:overflow-x-visible lg:px-8 lg:snap-none">
        {COLUMNS.map((col) => (
          <div
            key={col.status}
            className="flex w-[min(20rem,85vw)] shrink-0 snap-center flex-col border border-subtle lg:w-auto lg:min-w-0"
          >
            <h2 className="border-b border-subtle px-4 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              {col.label}
              <span className="ml-2 text-foreground">
                {grouped[col.status].length}
              </span>
            </h2>
            <ul className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
              {grouped[col.status].length === 0 && (
                <li className="px-1 py-6 text-sm text-muted">Nothing here.</li>
              )}
              {grouped[col.status].map((task) => (
                <li key={task.id} className="border border-subtle bg-surface p-3">
                  <p className="text-sm font-medium leading-5">{task.title}</p>
                  {task.description && (
                    <p className="mt-2 text-sm leading-5 text-muted">
                      {task.description}
                    </p>
                  )}
                  <p className="mt-3 text-[10px] uppercase tracking-[0.15em] text-muted">
                    {task.assigneeUsername}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {COLUMNS.filter((c) => c.status !== task.status).map((c) => (
                      <button
                        key={c.status}
                        type="button"
                        className={btnOutline}
                        onClick={() => void move(task, c.status)}
                      >
                        {c.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={btnOutline}
                      onClick={() => void remove(task.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
