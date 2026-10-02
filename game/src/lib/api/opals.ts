/**
 * `/api/game/opals/*` — buy opals with money.
 *
 * The price list and card methods are public. Checkout needs a session and
 * an enrolment of either side: the opals land on the season balance, the
 * same one the coin shop spends. A checkout either comes back paid (test
 * mode settles on the spot) or with a URL to the bank's payment page.
 */

import { apiFetch } from "./client";
import type {
  OpalCheckoutResult,
  OpalMethodView,
  OpalOrderView,
  OpalPackView,
  OpalPaymentMethod,
} from "./types";

export function list() {
  return apiFetch<{ packs: OpalPackView[]; methods: OpalMethodView[] }>(
    "/game/opals",
  );
}

export function checkout(packId: string, method: OpalPaymentMethod) {
  return apiFetch<OpalCheckoutResult>("/game/opals/checkout", {
    method: "POST",
    body: { packId, method },
  });
}

export function myOrders() {
  return apiFetch<{ orders: OpalOrderView[] }>("/game/opals/orders/mine");
}
