import { apiFetch } from "./client";
import type { PaymentAvailability } from "./types";

/**
 * What checkout may offer right now. Server-owned: an acquirer going live is a
 * config change on the API, not a deploy of this app.
 */
export function getPaymentMethods(): Promise<{
  methods: PaymentAvailability[];
  testMode: boolean;
}> {
  return apiFetch("/payments/methods");
}
