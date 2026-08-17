import { apiFetch } from "./client";
import type { SafeStaffUser, StaffRole } from "./types";

export const staffPeopleApi = {
  list() {
    return apiFetch<SafeStaffUser[]>("/staff/people");
  },

  create(body: {
    username: string;
    email: string;
    password: string;
    instagramUsername: string;
    role?: StaffRole;
  }) {
    return apiFetch<SafeStaffUser>("/staff/people", {
      method: "POST",
      body,
    });
  },

  changeRole(id: string, role: StaffRole) {
    return apiFetch<SafeStaffUser>(`/staff/people/${id}/role`, {
      method: "PATCH",
      body: { role },
    });
  },

  setBlocked(id: string, blocked: boolean) {
    return apiFetch<SafeStaffUser>(`/staff/people/${id}/block`, {
      method: "PATCH",
      body: { blocked },
    });
  },
};
