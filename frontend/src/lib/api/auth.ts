import { apiFetch } from "./client";
import type { LoginInput, RegisterInput, SafeUser } from "./types";

export function register(data: RegisterInput): Promise<{ user: SafeUser }> {
  return apiFetch("/auth/register", { method: "POST", body: data });
}

export function login(data: LoginInput): Promise<{ user: SafeUser }> {
  return apiFetch("/auth/login", { method: "POST", body: data });
}

export function logout(): Promise<{ success: boolean }> {
  return apiFetch("/auth/logout", { method: "POST" });
}

export function refresh(): Promise<{ user: SafeUser }> {
  return apiFetch("/auth/refresh", { method: "POST" });
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
