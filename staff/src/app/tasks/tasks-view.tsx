"use client";

import { useMemo, useState } from "react";
import {
  hasPerm,
  staffPeopleApi,
  staffTasksApi,
  type StaffTask,
  type StaffTaskStatus,
} from "@/lib/api";
import { formatDue } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { useStaffSession } from "@/components/providers";
import { IconPlus } from "@/components/icons";
import {
  Banner,
  BottomSheet,
  ErrorNote,
  Field,
  Loading,
  PageHeader,
  Segmented,
  btnSolid,
  btnSolidSm,
  chipSm,
  inputCls,
  pagePad,
  selectPlain,
} from "@/components/ui";

const COLUMNS: { status: StaffTaskStatus; label: string }[] = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "Doing" },
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
  const peopleList = people.data ?? [];
  const showBoardPicker = canViewOthers && peopleList.length > 1;
  const [assigneeId, setAssigneeId] = useState(user?.id ?? "");
  const boardFor = canViewOthers ? assigneeId || user?.id : user?.id;
  const tasks = useAsync(() => staffTasksApi.list(boardFor), [boardFor]);
  const [error, setError] = useState<string | null>(null);
  const [column, setColumn] = useState<StaffTaskStatus>("todo");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

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
      setColumn(status);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const due = String(data.get("dueDate") ?? "").trim();
    setError(null);
    try {
      const created = await staffTasksApi.create({
        title: String(data.get("title") ?? ""),
        description: String(data.get("description") ?? ""),
        assigneeId: canAssign
          ? String(data.get("assigneeId") || boardFor)
          : undefined,
        dueDate: due || undefined,
      });
      tasks.setData((prev) => [...(prev ?? []), created]);
      setColumn(created.status);
      form.reset();
      setSheetOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await staffTasksApi.remove(id);
      tasks.setData((prev) => (prev ?? []).filter((item) => item.id !== id));
      setConfirmId(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (tasks.loading) return <Loading label="Tasks" />;
  if (tasks.error)
    return <ErrorNote message={tasks.error} onRetry={tasks.reload} />;

  const addForm = (
    <TaskForm
      canAssign={canAssign}
      boardFor={boardFor}
      onSubmit={(e) => void create(e)}
    />
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        eyebrow="Board"
        title="Tasks"
        description="Move work across columns. On a phone, pick a column — don’t swipe the whole board."
        actions={
          showBoardPicker ? (
            <label className="flex w-full flex-col gap-2 sm:w-56">
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
                Whose board
              </span>
              <select
                className={selectPlain}
                value={assigneeId || user?.id}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                {peopleList.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.username}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
      />

      <div className={`hidden border-b border-subtle py-4 lg:block ${pagePad}`}>
        {addForm}
      </div>

      <div className={`${pagePad} py-3 lg:hidden`}>
        <Segmented
          ariaLabel="Task columns"
          value={column}
          onChange={setColumn}
          options={COLUMNS.map((col) => ({
            value: col.status,
            label: col.label,
            count: grouped[col.status].length,
          }))}
        />
      </div>

      <div className={`${pagePad} pb-2`}>
        <Banner message={error ?? ""} tone="error" />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4 pb-20 lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-x-visible lg:px-8 lg:pb-6">
        {COLUMNS.map((col) => {
          const hiddenOnPhone = col.status !== column;
          return (
            <div
              key={col.status}
              className={`flex h-full min-h-0 flex-col border border-subtle ${
                hiddenOnPhone ? "hidden lg:flex" : "flex"
              }`}
            >
              <h2 className="hidden border-b border-subtle px-4 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted lg:block">
                {col.label}
                <span className="ml-2 text-foreground">
                  {grouped[col.status].length}
                </span>
              </h2>
              <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                {grouped[col.status].length === 0 && (
                  <li className="px-1 py-10 text-sm leading-6 text-muted">
                    Nothing {col.label.toLowerCase()}. Add a task or move one
                    here.
                  </li>
                )}
                {grouped[col.status].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    confirming={confirmId === task.id}
                    onMove={move}
                    onAskDelete={() =>
                      setConfirmId((id) => (id === task.id ? null : task.id))
                    }
                    onConfirmDelete={() => void remove(task.id)}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className={`${btnSolid} fixed right-4 z-30 gap-2 lg:hidden`}
        style={{
          bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
        }}
      >
        <IconPlus className="size-4" />
        Add
      </button>

      <BottomSheet
        open={sheetOpen}
        title="New task"
        onClose={() => setSheetOpen(false)}
      >
        {addForm}
      </BottomSheet>
    </section>
  );
}

function TaskForm({
  canAssign,
  boardFor,
  onSubmit,
}: {
  canAssign: boolean;
  boardFor: string | undefined;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_auto_auto] lg:items-end"
    >
      <Field id="task-title" label="Title">
        <input
          id="task-title"
          name="title"
          required
          autoComplete="off"
          className={inputCls}
        />
      </Field>
      <Field id="task-body" label="Notes" optional>
        <input id="task-body" name="description" className={inputCls} />
      </Field>
      <Field id="task-due" label="Due" optional>
        <input id="task-due" name="dueDate" type="date" className={inputCls} />
      </Field>
      {canAssign && (
        <input type="hidden" name="assigneeId" value={boardFor} />
      )}
      <button
        type="submit"
        className={`${btnSolidSm} w-full sm:col-span-2 lg:col-span-1 lg:w-auto`}
      >
        Add
      </button>
    </form>
  );
}

function TaskCard({
  task,
  confirming,
  onMove,
  onAskDelete,
  onConfirmDelete,
}: {
  task: StaffTask;
  confirming: boolean;
  onMove: (task: StaffTask, status: StaffTaskStatus) => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const due = formatDue(task.dueDate);
  return (
    <li className="border border-subtle bg-surface p-3">
      <p className="text-sm font-medium leading-5">{task.title}</p>
      {task.description && (
        <p className="mt-2 text-sm leading-5 text-muted">{task.description}</p>
      )}
      <p className="mt-3 text-[10px] uppercase tracking-[0.15em] text-muted">
        {task.assigneeUsername}
        {due ? ` · ${due}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {COLUMNS.filter((c) => c.status !== task.status).map((c) => (
          <button
            key={c.status}
            type="button"
            className={chipSm}
            onClick={() => onMove(task, c.status)}
          >
            {c.label}
          </button>
        ))}
        {confirming ? (
          <button type="button" className={chipSm} onClick={onConfirmDelete}>
            Sure?
          </button>
        ) : (
          <button type="button" className={chipSm} onClick={onAskDelete}>
            Delete
          </button>
        )}
      </div>
    </li>
  );
}
