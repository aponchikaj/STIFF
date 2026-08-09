import { apiFetch } from "./client";
import type {
  Comment,
  MyReaction,
  Order,
  Paginated,
  PaginationParams,
  ReactionType,
  SafeUser,
  UserSettings,
  UserStats,
} from "./types";

export function getStats(): Promise<UserStats> {
  return apiFetch("/users/me/stats");
}

export function getMyOrders(
  params?: PaginationParams,
): Promise<Paginated<Order>> {
  return apiFetch("/users/me/orders", { query: { ...params } });
}

export function getMyComments(
  params?: PaginationParams,
): Promise<Paginated<Comment>> {
  return apiFetch("/users/me/comments", { query: { ...params } });
}

export function getMyReactions(
  params?: PaginationParams & { type?: ReactionType },
): Promise<Paginated<MyReaction>> {
  return apiFetch("/users/me/reactions", { query: { ...params } });
}

export function updateProfile(data: {
  username?: string;
}): Promise<SafeUser> {
  return apiFetch("/users/me", { method: "PATCH", body: data });
}

export function getSettings(): Promise<UserSettings> {
  return apiFetch("/users/me/settings");
}

export function updateSettings(
  data: Partial<Pick<UserSettings, "theme" | "emailNotifications">>,
): Promise<UserSettings> {
  return apiFetch("/users/me/settings", { method: "PATCH", body: data });
}

export function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean }> {
  return apiFetch("/users/me/password", { method: "PATCH", body: data });
}
