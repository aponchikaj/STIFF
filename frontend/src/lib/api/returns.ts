import { apiFetch } from "./client";
import type {
  Paginated,
  ReturnEligibility,
  ReturnRequest,
  ReturnStatus,
} from "./types";

/**
 * Returns for one order. Reachable with just the order id, matching how the
 * receipt page itself works for guests.
 */
export function getForOrder(orderId: string): Promise<{
  requests: ReturnRequest[];
  eligibility: ReturnEligibility;
}> {
  return apiFetch(`/returns/order/${orderId}`);
}

export function requestReturn(
  orderId: string,
  data: {
    items: { orderItemId: string; quantity: number }[];
    reason?: string;
  },
): Promise<ReturnRequest> {
  return apiFetch(`/returns/order/${orderId}`, { method: "POST", body: data });
}

// ---------- admin ----------

export function listReturns(params: {
  status?: ReturnStatus;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<ReturnRequest>> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  return apiFetch(`/returns?${query.toString()}`);
}

export function resolveReturn(
  id: string,
  data: {
    status: ReturnStatus;
    resolutionNote?: string;
    refundCents?: number;
  },
): Promise<ReturnRequest> {
  return apiFetch(`/returns/${id}`, { method: "PATCH", body: data });
}
