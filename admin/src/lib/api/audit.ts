import { apiFetch } from "./client";
import type { Paginated } from "./types";

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorEmail: string;
  actorUsername: string;
  origin: "admin" | "shop";
  method: string;
  path: string;
  statusCode: number;
  ip: string | null;
  userAgent: string | null;
  changes: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListAuditParams {
  page?: number;
  pageSize?: number;
  actorId?: string;
  method?: string;
  path?: string;
}

export function listAudit(
  params: ListAuditParams = {},
): Promise<Paginated<AuditEntry>> {
  return apiFetch("/admin/audit", { query: { ...params } });
}
