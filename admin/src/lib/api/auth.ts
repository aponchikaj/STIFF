import { apiFetch } from "./client";
import type { SafeUser } from "./types";

/**
 * The admin.stiff.ge session.
 *
 * Separate endpoints from the shop's `/auth/*` and a separate cookie pair, so
 * signing in here neither creates nor consumes a shop session. There is no
 * register, no password reset and no email verification: admins are made by
 * promoting an existing shop account, not by signing up on this origin.
 */

export interface AdminLoginInput {
  emailOrUsername: string;
  password: string;
}

interface AdminSessionResponse {
  user: SafeUser;
}

export function login(data: AdminLoginInput): Promise<AdminSessionResponse> {
  return apiFetch("/admin/auth/login", { method: "POST", body: data });
}

export function logout(): Promise<{ success: boolean }> {
  return apiFetch("/admin/auth/logout", { method: "POST" });
}

/** Ends every admin session for this account, on every device. */
export function logoutEverywhere(): Promise<{ success: boolean }> {
  return apiFetch("/admin/auth/logout-everywhere", { method: "POST" });
}

export function getMe(): Promise<SafeUser> {
  // The session check must not trigger the client's refresh-and-retry: a
  // signed-out visitor would otherwise spend a pointless round-trip before
  // being shown the sign-in form.
  return apiFetch("/admin/auth/me", { skipRefresh: true });
}
