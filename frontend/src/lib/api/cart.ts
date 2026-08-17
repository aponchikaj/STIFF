import type { PaymentMethod, ShippingMethod } from "../checkout";
import { apiFetch } from "./client";
import type { CartView, Order, ShippingAddress } from "./types";

export function getCart(): Promise<CartView> {
  return apiFetch("/cart");
}

export function addToCart(
  productId: string,
  quantity: number,
  size?: string,
): Promise<CartView> {
  return apiFetch("/cart/items", {
    method: "POST",
    body: { productId, quantity, size },
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
}): Promise<Order> {
  return apiFetch("/orders/checkout", { method: "POST", body: data });
}

export function buyNow(data: {
  productId: string;
  quantity: number;
  size?: string;
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
}): Promise<Order> {
  return apiFetch("/orders/buy-now", { method: "POST", body: data });
}

export function getOrder(id: string): Promise<Order> {
  return apiFetch(`/orders/${id}`);
}
