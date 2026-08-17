import { apiFetch } from "./client";
import type { StaffTask, StaffTaskStatus } from "./types";

export const staffTasksApi = {
  list(assigneeId?: string) {
    return apiFetch<StaffTask[]>("/staff/tasks", {
      query: { assigneeId },
    });
  },

  create(body: {
    title: string;
    description?: string;
    status?: StaffTaskStatus;
    assigneeId?: string;
    dueDate?: string;
  }) {
    return apiFetch<StaffTask>("/staff/tasks", { method: "POST", body });
  },

  update(
    id: string,
    body: Partial<{
      title: string;
      description: string;
      status: StaffTaskStatus;
      position: number;
      assigneeId: string;
      dueDate: string | null;
    }>,
  ) {
    return apiFetch<StaffTask>(`/staff/tasks/${id}`, {
      method: "PATCH",
      body,
    });
  },

  remove(id: string) {
    return apiFetch<{ success: boolean }>(`/staff/tasks/${id}`, {
      method: "DELETE",
    });
  },
};
