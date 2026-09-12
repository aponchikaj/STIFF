import { apiFetch } from "./client";

/**
 * The game's coin shop, as the panel sees it.
 *
 * Distinct from the storefront's products: these are sold for the coins the
 * game mints, to players and watchers, and live under `/api/game/admin/*`
 * behind the same admin session. Kept in its own module so a change to the
 * shop's product shapes cannot drift into this one.
 */

export type ShopItemStatus = "draft" | "live" | "archived";
export type PurchaseStatus = "paid" | "fulfilled" | "cancelled";

export interface GameShopItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCoins: number;
  /** Null is unlimited. */
  stock: number | null;
  /** Null is unlimited. */
  perPersonLimit: number | null;
  status: ShopItemStatus;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameShopItemInput {
  name: string;
  description?: string;
  imageUrl?: string;
  priceCoins: number;
  stock?: number;
  perPersonLimit?: number;
  status?: ShopItemStatus;
  sortOrder?: number;
}

/** Nulls clear a limit — the backend reads `null` as unlimited. */
export interface UpdateGameShopItemInput {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  priceCoins?: number;
  stock?: number | null;
  perPersonLimit?: number | null;
  status?: ShopItemStatus;
  sortOrder?: number;
}

export interface GamePurchase {
  id: string;
  itemId: string;
  enrolmentId: string;
  userId: string;
  itemName: string;
  priceCoins: number;
  status: PurchaseStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  enrolment?: { handle: string } | null;
}

export function listItems(params?: {
  status?: ShopItemStatus;
}): Promise<{ items: GameShopItem[] }> {
  return apiFetch("/game/admin/shop/items", { query: params });
}

export function createItem(
  data: CreateGameShopItemInput,
): Promise<GameShopItem> {
  return apiFetch("/game/admin/shop/items", { method: "POST", body: data });
}

export function updateItem(
  id: string,
  data: UpdateGameShopItemInput,
): Promise<GameShopItem> {
  return apiFetch(`/game/admin/shop/items/${id}`, {
    method: "PATCH",
    body: data,
  });
}

export function listPurchases(params?: {
  status?: PurchaseStatus;
  itemId?: string;
  limit?: number;
}): Promise<{ purchases: GamePurchase[] }> {
  return apiFetch("/game/admin/shop/purchases", { query: params });
}

/** Handed over, or cancelled — the backend refunds coins and stock on cancel. */
export function setPurchaseStatus(
  id: string,
  status: "fulfilled" | "cancelled",
  note?: string,
): Promise<GamePurchase> {
  return apiFetch(`/game/admin/shop/purchases/${id}`, {
    method: "PATCH",
    body: { status, ...(note ? { note } : {}) },
  });
}
