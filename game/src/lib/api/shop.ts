/**
 * `/api/game/shop/*` — spend coins.
 *
 * The list is public so the shop is a reason to want an account. Buying
 * needs a session and an enrolment of either side: players and watchers
 * hold coins alike.
 */

import { apiFetch } from "./client";
import type { PurchaseView, ShopItemView } from "./types";

export function list() {
  return apiFetch<{ items: ShopItemView[] }>("/game/shop");
}

export function buy(itemId: string) {
  return apiFetch<{ purchase: PurchaseView }>(`/game/shop/${itemId}/buy`, {
    method: "POST",
  });
}

export function myPurchases() {
  return apiFetch<{ purchases: PurchaseView[] }>("/game/shop/purchases/mine");
}
