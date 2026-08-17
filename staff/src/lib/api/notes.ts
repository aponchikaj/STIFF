import { apiFetch } from "./client";
import type { StaffNote } from "./types";

export const staffNotesApi = {
  list() {
    return apiFetch<StaffNote[]>("/staff/notes");
  },

  create(body: { title: string; body?: string }) {
    return apiFetch<StaffNote>("/staff/notes", { method: "POST", body });
  },

  update(
    id: string,
    body: Partial<{ title: string; body: string; pinned: boolean }>,
  ) {
    return apiFetch<StaffNote>(`/staff/notes/${id}`, {
      method: "PATCH",
      body,
    });
  },

  remove(id: string) {
    return apiFetch<{ success: boolean }>(`/staff/notes/${id}`, {
      method: "DELETE",
    });
  },
};
