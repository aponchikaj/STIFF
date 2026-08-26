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

