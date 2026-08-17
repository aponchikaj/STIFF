import { apiFetch, clearTokens, saveTokens } from "./client";
import type { AuthResponse, SafeStaffUser } from "./types";

export const staffAuthApi = {
  login(body: { emailOrUsername: string; password: string }) {
    return apiFetch<AuthResponse>("/staff/auth/login", {
      method: "POST",
      body,
    }).then((data) => {
      saveTokens(data);
      return data;
    });
  },

  logout() {
    return apiFetch<{ success: boolean }>("/staff/auth/logout", {
      method: "POST",
      body: {},
    }).finally(() => {
      clearTokens();
    });
  },

  me() {
    return apiFetch<SafeStaffUser>("/staff/auth/me");
  },
};
