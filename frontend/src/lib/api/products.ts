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
  return apiFetch("/products", { query: { ...params } });
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
