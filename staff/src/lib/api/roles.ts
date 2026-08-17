import { apiFetch } from "./client";
import type {
  StaffPermission,
  StaffPermissionMeta,
  StaffRole,
} from "./types";

export const staffRolesApi = {
  catalog() {
    return apiFetch<StaffPermissionMeta[]>("/staff/roles/catalog");
  },

  list() {
    return apiFetch<StaffRole[]>("/staff/roles");
  },

  create(body: { name: string; permissions: StaffPermission[] }) {
    return apiFetch<StaffRole>("/staff/roles", { method: "POST", body });
  },

  update(
    id: string,
    body: { name?: string; permissions?: StaffPermission[] },
  ) {
    return apiFetch<StaffRole>(`/staff/roles/${id}`, {
      method: "PATCH",
      body,
    });
  },

  remove(id: string) {
    return apiFetch<{ success: boolean }>(`/staff/roles/${id}`, {
      method: "DELETE",
    });
  },
};
