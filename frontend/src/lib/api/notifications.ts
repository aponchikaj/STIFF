import { apiFetch } from "./client";
import type { Notification, Paginated, PaginationParams } from "./types";

export function listNotifications(
  params?: PaginationParams & { unreadOnly?: boolean },
): Promise<Paginated<Notification> & { unreadCount: number }> {
  return apiFetch("/notifications", { query: { ...params } });
}

export function markRead(id: string): Promise<Notification> {
  return apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllRead(): Promise<{ success: boolean; updated: number }> {
  return apiFetch("/notifications/read-all", { method: "PATCH" });
}

export function deleteNotification(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/notifications/${id}`, { method: "DELETE" });
}
