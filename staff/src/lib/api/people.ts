import { apiFetch } from "./client";
import type { SafeStaffUser } from "./types";

export const staffPeopleApi = {
  list() {
    return apiFetch<SafeStaffUser[]>("/staff/people");
  },

  create(body: {
    username: string;
    email: string;
    password: string;
    instagramUsername: string;
    roleId?: string;
  }) {
    return apiFetch<SafeStaffUser>("/staff/people", {
      method: "POST",
      body,
    });
  },

  changeRole(id: string, roleId: string) {
    return apiFetch<SafeStaffUser>(`/staff/people/${id}/role`, {
      method: "PATCH",
      body: { roleId },
    });
  },

  setBlocked(id: string, blocked: boolean) {
    return apiFetch<SafeStaffUser>(`/staff/people/${id}/block`, {
      method: "PATCH",
      body: { blocked },
    });
  },
};
