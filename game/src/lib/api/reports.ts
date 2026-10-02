/**
 * `/api/game/reports/*` — saying something is wrong.
 *
 * The catalogue is public so the sheet can be drawn before anyone signs in.
 * Filing needs a session and only a session: a watcher who never enrolled
 * can still report a comment.
 */

import { apiFetch } from "./client";
import type { CreateReportInput, ReportCatalogue, ReportView } from "./types";

/** What can be reported, for what. Drives the sheet's options — do not
 *  hardcode reasons in a component, they are per target type. */
export function reasons() {
  return apiFetch<ReportCatalogue>("/game/reports/reasons");
}

export function create(input: CreateReportInput) {
  return apiFetch<{ report: ReportView }>("/game/reports", {
    method: "POST",
    body: input,
  });
}

export function mine(limit?: number) {
  return apiFetch<{ reports: ReportView[] }>("/game/reports/mine", {
    query: { limit },
  });
}

/** Taken back, while it is still on the queue. */
export function withdraw(id: string) {
  return apiFetch<{ report: ReportView }>(`/game/reports/${id}`, { method: "DELETE" });
}
