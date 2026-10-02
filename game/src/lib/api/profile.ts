/**
 * `/api/users/me/*` — the account behind the player.
 *
 * Separate from the enrolment: an enrolment is per season and can be
 * demoted, the account is forever. Settings live here, the handle lives on
 * the enrolment.
 */

import { apiFetch } from "./client";
import type { SafeUser } from "./types";

export interface UserSettings {
  theme: string;
  emailNotifications: boolean;
  [key: string]: unknown;
}

export function settings() {
  return apiFetch<UserSettings>("/users/me/settings");
}

export function updateSettings(patch: Partial<UserSettings>) {
  return apiFetch<UserSettings>("/users/me/settings", { method: "PATCH", body: patch });
}

/** Username and/or email. A new address is unverified until proven. */
export function updateProfile(patch: { username?: string; email?: string }) {
  return apiFetch<{ user: SafeUser }>("/users/me", { method: "PATCH", body: patch });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ success: true }>("/users/me/password", {
    method: "PATCH",
    body: { currentPassword, newPassword },
  });
}

export function stats() {
  return apiFetch<Record<string, number>>("/users/me/stats");
}
