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
  // Deliberately *does* go through the refresh-and-retry. The access token
  // lasts fifteen minutes and the refresh cookie thirty days; a session check
  // that gave up on the first 401 would throw the admin out every quarter of
  // an hour. A genuinely signed-out visitor pays one extra round-trip, which
  // is the cheaper end of that trade by a distance.
  return apiFetch("/admin/auth/me");
}
