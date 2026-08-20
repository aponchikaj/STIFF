import { apiFetch } from "./client";
import type {
  DiscountCode,
  DiscountKind,
  GiftCard,
  Paginated,
  PriceBreakdown,
} from "./types";
import type { ShippingMethod } from "../checkout";

/**
 * Prices the current cart with codes applied, without committing anything.
 *
 * Checkout re-resolves the same codes server-side, so this is a preview — it
 * can legitimately differ by the time you pay if a code runs out.
 */
export function quote(data: {
  shippingMethod: ShippingMethod;
  discountCode?: string;
  giftCardCode?: string;
  email?: string;
}): Promise<PriceBreakdown> {
  return apiFetch("/promotions/quote", { method: "POST", body: data });
}

// ---------- admin ----------

export function listDiscounts(params: {
  page?: number;
  pageSize?: number;
}): Promise<Paginated<DiscountCode>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  return apiFetch(`/promotions/discounts?${query.toString()}`);
}

export function createDiscount(data: {
  code: string;
  kind: DiscountKind;
  value: number;
  minSubtotalCents?: number;
  usageLimit?: number;
  perUserLimit?: number;
  expiresAt?: string;
  note?: string;
}): Promise<DiscountCode> {
  return apiFetch("/promotions/discounts", { method: "POST", body: data });
}

export function updateDiscount(
  id: string,
  data: { isActive?: boolean; note?: string },
): Promise<DiscountCode> {
  return apiFetch(`/promotions/discounts/${id}`, {
    method: "PATCH",
    body: data,
  });
}

export function listGiftCards(params: {
  page?: number;
  pageSize?: number;
}): Promise<Paginated<GiftCard>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  return apiFetch(`/promotions/gift-cards?${query.toString()}`);
}

export function createGiftCard(data: {
  code?: string;
  initialCents: number;
  expiresAt?: string;
  note?: string;
}): Promise<GiftCard> {
  return apiFetch("/promotions/gift-cards", { method: "POST", body: data });
}

export function setGiftCardActive(
  id: string,
  isActive: boolean,
): Promise<GiftCard> {
  return apiFetch(`/promotions/gift-cards/${id}`, {
    method: "PATCH",
    body: { isActive },
  });
}
