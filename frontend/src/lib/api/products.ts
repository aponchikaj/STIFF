import { apiFetch } from "./client";
import type {
  FitReport,
  FitValue,
  Paginated,
  Product,
  ProductDetail,
  ProductListParams,
} from "./types";

export function listProducts(
  params?: ProductListParams,
): Promise<Paginated<Product>> {
  const { ids, ...rest } = params ?? {};
  return apiFetch("/products", {
    // Comma-joined, because a query string carries scalars — the backend
    // splits it back into a list.
    query: { ...rest, ...(ids?.length ? { ids: ids.join(",") } : {}) },
  });
}

export function getProduct(idOrSlug: string): Promise<ProductDetail> {
  return apiFetch(`/products/${encodeURIComponent(idOrSlug)}`);
}

/**
 * Record how a piece fits.
 *
 * The server refuses this from anyone who has not bought it — which is the
 * whole reason the reading is worth showing.
 */
export function rateFit(
  productId: string,
  value: FitValue,
): Promise<FitReport> {
  return apiFetch(`/products/${productId}/fit`, {
    method: "POST",
    body: { value },
  });
}

export function clearFit(productId: string): Promise<FitReport> {
  return apiFetch(`/products/${productId}/fit`, { method: "DELETE" });
}
