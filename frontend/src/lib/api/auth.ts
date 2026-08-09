import {
  apiFetch,
  clearTokens,
  getStoredRefreshToken,
  saveTokens,
} from "./client";
import type { LoginInput, RegisterInput, SafeUser } from "./types";

interface AuthResponse {
  user: SafeUser;
  accessToken?: string;
  refreshToken?: string;
}

export async function register(data: RegisterInput): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: data,
  });
  saveTokens(res);
  return res;
}

export async function login(data: LoginInput): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: data,
  });
  saveTokens(res);
  return res;
}

export async function logout(): Promise<{ success: boolean }> {
  const stored = getStoredRefreshToken();
  try {
    return await apiFetch("/auth/logout", {
      method: "POST",
      body: stored ? { refreshToken: stored } : {},
    });
  } finally {
    clearTokens();
  }
}

export async function refresh(): Promise<AuthResponse> {
  const stored = getStoredRefreshToken();
  const res = await apiFetch<AuthResponse>("/auth/refresh", {
    method: "POST",
    body: stored ? { refreshToken: stored } : {},
  });
  saveTokens(res);
  return res;
}

export function getMe(): Promise<SafeUser> {
  return apiFetch("/auth/me");
}

export function verifyEmail(token: string): Promise<{ success: boolean }> {
  return apiFetch("/auth/verify-email", { method: "POST", body: { token } });
}

export function resendVerification(): Promise<{ success: boolean }> {
  return apiFetch("/auth/resend-verification", { method: "POST" });
}

export function forgotPassword(email: string): Promise<{ success: boolean }> {
  return apiFetch("/auth/forgot-password", { method: "POST", body: { email } });
}

export function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  return apiFetch("/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
  });
}

export function deleteAccount(password: string): Promise<{ success: boolean }> {
  return apiFetch("/auth/account", { method: "DELETE", body: { password } });
}
