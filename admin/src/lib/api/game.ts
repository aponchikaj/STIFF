import { apiFetch } from "./client";

/**
 * The panel's view of the rhythm game.
 *
 * These hit `/api/game/admin/*`, which lives on the shop's own controller
 * under `@Roles('admin')` — so every call here is recorded in the audit log
 * with before/after state without the panel doing anything.
 */

export interface GameOverview {
  songs: number;
  charts: number;
  approvedCharts: number;
  runs: number;
  rejections: number;
  pendingReview: number;
  coinsMinted: number;
  /** Negative. The tab shows it against what was minted. */
  coinsSpent: number;
}

export interface AdminChart {
  id: string;
  songId: string;
  songTitle?: string;
  difficulty: string;
  version: number;
  status: "draft" | "approved" | "archived";
  generatedBy: string;
  generatorModel: string | null;
  chartHash: string;
  noteCount: number;
  npsPeak: number;
  npsAvg: number;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface AdminRejection {
  id: string;
  userId: string;
  username?: string;
  chartId: string | null;
  songTitle?: string;
  difficulty?: string;
  reason: string;
  detail: Record<string, unknown>;
  createdAt: string;
  reviewedAt: string | null;
  action: string | null;
}

export function gameOverview() {
  return apiFetch<GameOverview>("/game/admin/overview");
}

export function gameCharts() {
  return apiFetch<AdminChart[]>("/game/admin/charts");
}

export function approveChart(id: string) {
  return apiFetch<AdminChart>(`/game/admin/charts/${id}/approve`, {
    method: "POST",
  });
}

export function archiveChart(id: string) {
  return apiFetch<AdminChart>(`/game/admin/charts/${id}/archive`, {
    method: "POST",
  });
}

export function gameRejections(reviewed = false) {
  return apiFetch<AdminRejection[]>(
    `/game/admin/rejections?reviewed=${reviewed}`,
  );
}

export function reviewRejection(
  id: string,
  action: "dismissed" | "voided" | "suspended",
) {
  return apiFetch<AdminRejection>(`/game/admin/rejections/${id}/review`, {
    method: "POST",
    body: { action },
  });
}

export function gameEconomy() {
  return apiFetch<Record<string, unknown>>("/game/admin/economy");
}

export function writeEconomy(key: string, value: unknown) {
  return apiFetch<unknown>("/game/admin/economy", {
    method: "PUT",
    body: { key, value },
  });
}
