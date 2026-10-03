/**
 * `/api/notifications/*` — the shop's notification spine, shared.
 *
 * The game writes into it: a settled verdict, a resolved report, a war that
 * paid out. One inbox rather than two is why a player sees a shop order
 * update and a cheating verdict in the same list.
 */

import { apiFetch } from "./client";
import type { NotificationView } from "./types";

/** As `GET /notifications` sends it: `items`, not `data`, plus the unread count. */
export interface NotificationPage {
  items: NotificationView[];
  total: number;
  page: number;
  pageSize: number;
  unreadCount: number;
}

export function list(query: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}) {
  return apiFetch<NotificationPage>("/notifications", { query: { ...query } });
}

export function markRead(id: string) {
  // The updated notification itself, not `{ success }`.
  return apiFetch<NotificationView>(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllRead() {
  return apiFetch<{ success: true }>("/notifications/read-all", { method: "PATCH" });
}

export function remove(id: string) {
  return apiFetch<{ success: true }>(`/notifications/${id}`, { method: "DELETE" });
}
