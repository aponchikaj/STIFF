import type { PaymentMethod, ShippingMethod } from "../checkout";
import { apiFetch } from "./client";
import type {
  CartView,
  Order,
  PlacedOrder,
  ShippingAddress,
} from "./types";

export function getCart(): Promise<CartView> {
  return apiFetch("/cart");
}

/**
 * `variantId` is the real argument — it names the exact colour and size.
 *
 * `size` rides along so a line still reads correctly if the variant is later
 * deleted, and so a link that predates colourways keeps working.
 */
export function addToCart(
  productId: string,
  quantity: number,
  options: { variantId?: string; size?: string; color?: string } = {},
): Promise<CartView> {
  return apiFetch("/cart/items", {
    method: "POST",
    body: { productId, quantity, ...options },
  });
}

export function updateCartItem(
  itemId: string,
  quantity: number,
): Promise<CartView> {
  return apiFetch(`/cart/items/${itemId}`, {
    method: "PATCH",
    body: { quantity },
  });
}

export function removeCartItem(itemId: string): Promise<CartView> {
  return apiFetch(`/cart/items/${itemId}`, { method: "DELETE" });
}

export function clearCart(): Promise<{ success: boolean }> {
  return apiFetch("/cart", { method: "DELETE" });
}

export function checkout(data: {
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  /** Required when nobody is signed in. */
  email?: string;
  discountCode?: string;
  giftCardCode?: string;
}): Promise<PlacedOrder> {
  return apiFetch("/orders/checkout", { method: "POST", body: data });
}

export function buyNow(data: {
  productId: string;
  quantity: number;
  variantId?: string;
  size?: string;
  color?: string;
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  /** Required when nobody is signed in. */
  email?: string;
  discountCode?: string;
  giftCardCode?: string;
}): Promise<PlacedOrder> {
  return apiFetch("/orders/buy-now", { method: "POST", body: data });
}

export function getOrder(id: string): Promise<Order> {
  return apiFetch(`/orders/${id}`);
}

/** Customer cancellation. Works for guests with just the order id. */
export function cancelOrder(id: string): Promise<Order> {
  return apiFetch(`/orders/${id}/cancel`, { method: "POST" });
}
