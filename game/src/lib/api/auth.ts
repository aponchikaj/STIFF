/**
 * `/api/auth/*` — the shop's own session endpoints.
 *
 * The game has no separate account system. `POST /game/register` is the
 * game-shaped front door (a side, no email, an age gate) but it mints the
 * same shop token these routes do, so signing in here signs you in on
 * stiff.ge as well. That is the point.
 *
 * Every function that returns tokens saves them — the Bearer fallback has to
 * be populated at the same moment the cookie is set, or a cross-site browser
 * that dropped the cookie would look signed out on the very next request.
 */

import { apiFetch, clearTokens, getStoredRefreshToken, saveTokens } from "./client";
import type { AuthResult, AuthTokens, SafeUser } from "./types";

export async function login(emailOrUsername: string, password: string) {
  const result = await apiFetch<AuthResult>("/auth/login", {
    method: "POST",
    body: { emailOrUsername, password },
  });
  saveTokens(result);
  return result;
}

/**
 * The shop's sign-up: username, **email required**, password.
 *
 * Prefer `gameApi.register` for anyone arriving through the game — it asks
 * for less and runs the age gate. This exists for a visitor who came the
 * other way and wants a full shop account up front.
 */
export async function register(input: {
  username: string;
  email: string;
  password: string;
}) {
  const result = await apiFetch<AuthResult>("/auth/register", {
    method: "POST",
    body: input,
  });
  saveTokens(result);
  return result;
}

/** Rotates the pair. `apiFetch` already does this on a 401 — call it by hand
 *  only to warm a session on boot. */
export async function refresh() {
  const stored = getStoredRefreshToken();
  const result = await apiFetch<AuthTokens>("/auth/refresh", {
    method: "POST",
    body: stored ? { refreshToken: stored } : {},
    skipRefresh: true,
  });
  saveTokens(result);
  return result;
}

export async function logout() {
  try {
    await apiFetch<{ success: true }>("/auth/logout", { method: "POST" });
  } finally {
    // Always clear locally. A failed server call must not leave a dead token
    // in storage that makes the next load look signed in.
    clearTokens();
  }
}

/** The bare user — not wrapped in `{ user }`, unlike the login response.
 *  Reading `.user` off it gave `undefined`, and the whole game decided
 *  nobody was ever signed in. */
export function me() {
  return apiFetch<SafeUser>("/auth/me");
}

export function verifyEmail(token: string) {
  return apiFetch<{ success: true }>("/auth/verify-email", {
    method: "POST",
    body: { token },
  });
}

export function resendVerification() {
  return apiFetch<{ success: true }>("/auth/resend-verification", { method: "POST" });
}

/** Needs an address on the account. A game sign-up has none until they add one. */
export function forgotPassword(email: string) {
  return apiFetch<{ success: true }>("/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
}

export function resetPassword(token: string, newPassword: string) {
  return apiFetch<{ success: true }>("/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
  });
}

export async function deleteAccount(password: string) {
  const result = await apiFetch<{ success: true }>("/auth/account", {
    method: "DELETE",
    body: { password },
  });
  clearTokens();
  return result;
}
