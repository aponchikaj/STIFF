"use client";

import { useMemo, useState } from "react";
import {
  staffPeopleApi,
  staffTasksApi,
  type StaffTask,
  type StaffTaskStatus,
} from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import { useStaffSession } from "@/components/providers";
import {
  btnOutline,
  btnSolidSm,
  ErrorNote,
  Field,
  inputCls,
  Loading,
  selectCls,
} from "@/components/ui";

const COLUMNS: { status: StaffTaskStatus; label: string }[] = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Done" },
];

export function TasksView() {
  const { user } = useStaffSession();
  const isManager = user?.role === "owner" || user?.role === "admin";
  const people = useAsync(() => staffPeopleApi.list(), []);
  const [assigneeId, setAssigneeId] = useState(user?.id ?? "");
  const boardFor = isManager ? assigneeId || user?.id : user?.id;
  const tasks = useAsync(
    () => staffTasksApi.list(boardFor),
    [boardFor],
  );
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
        assigneeId: isManager
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
  if (tasks.error) return <ErrorNote message={tasks.error} />;

  return (
    <section className="flex flex-1 flex-col overflow-hidden px-5 py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
        Board
      </p>
      <h1 className="mt-1 text-3xl uppercase tracking-tight">Tasks</h1>

      {isManager && (
        <label className="mt-6 flex max-w-xs flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Board
          </span>
          <select
            className={selectCls}
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
      )}

      <form
        onSubmit={(e) => void create(e)}
        className="mt-8 grid gap-3 border border-subtle p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
      >
        <Field id="task-title" label="Title">
          <input id="task-title" name="title" required className={inputCls} />
        </Field>
        <Field id="task-body" label="Notes">
          <input id="task-body" name="description" className={inputCls} />
        </Field>
        {isManager && (
          <input type="hidden" name="assigneeId" value={boardFor} />
        )}
        <button type="submit" className={btnSolidSm}>
          Add
        </button>
      </form>
      {error && <p className="mt-3 text-xs text-muted">{error}</p>}

      <div className="mt-8 grid min-h-0 flex-1 gap-4 overflow-x-auto pb-8 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <div key={col.status} className="flex min-w-64 flex-col border border-subtle">
            <h2 className="border-b border-subtle px-4 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              {col.label}
              <span className="ml-2 text-foreground">
                {grouped[col.status].length}
              </span>
            </h2>
            <ul className="flex flex-col gap-3 p-3">
              {grouped[col.status].map((task) => (
                <li key={task.id} className="border border-subtle bg-surface p-3">
                  <p className="text-sm font-medium">{task.title}</p>
                  {task.description && (
                    <p className="mt-2 text-xs leading-5 text-muted">
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
