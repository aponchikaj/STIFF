import { apiFetch } from "./client";
import type {
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
