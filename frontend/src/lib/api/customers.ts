import { apiFetch } from "./client";
import type { Product, UserAddress } from "./types";

// ---------- saved addresses ----------

export function listAddresses(): Promise<UserAddress[]> {
  return apiFetch("/addresses");
}

export interface AddressInput {
  label?: string;
  firstName: string;
  lastName: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone: string;
  isDefault?: boolean;
}

export function createAddress(data: AddressInput): Promise<UserAddress> {
  return apiFetch("/addresses", { method: "POST", body: data });
}

export function updateAddress(
  id: string,
  data: AddressInput,
): Promise<UserAddress> {
  return apiFetch(`/addresses/${id}`, { method: "PATCH", body: data });
}

export function deleteAddress(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/addresses/${id}`, { method: "DELETE" });
}

/** The regions the checkout dropdown offers. */
export function getRegions(): Promise<{ regions: string[] }> {
  return apiFetch("/addresses/regions");
}

// ---------- back in stock ----------

/** Email is required only when nobody is signed in. */
export function subscribeToStock(data: {
  variantId: string;
  email?: string;
}): Promise<{ subscribed: true }> {
  return apiFetch("/stock-alerts", { method: "POST", body: data });
}

// ---------- cross-sell ----------

export function getCrossSell(): Promise<{ products: Product[] }> {
  return apiFetch("/cross-sell");
}

// ---------- wishlist ----------

/**
 * Saved pieces, newest first.
 *
 * Private by design: there is no route that reads someone else's. A like is
 * the public signal; this is intent, and conflating the two loses both.
 */
export function listWishlist(): Promise<Product[]> {
  return apiFetch("/wishlist");
}

/** Just the ids, so a grid fills every heart in one request. */
export function wishlistIds(): Promise<{ productIds: string[] }> {
  return apiFetch("/wishlist/ids");
}

export function toggleWishlist(productId: string): Promise<{ saved: boolean }> {
  return apiFetch(`/wishlist/${productId}`, { method: "POST" });
}

export function unsave(productId: string): Promise<{ success: boolean }> {
  return apiFetch(`/wishlist/${productId}`, { method: "DELETE" });
}

/** Folds a signed-out list into the account being signed into. */
export function mergeWishlist(
  productIds: string[],
): Promise<{ productIds: string[] }> {
  return apiFetch("/wishlist/merge", {
    method: "POST",
    body: { productIds },
  });
}
