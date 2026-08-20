/**
 * Whether a line may be sold, and on what terms.
 *
 * Pure so the rules can be tested directly — "why did it let me order 12 of
 * something with 3 in stock" needs an answer that does not depend on reading a
 * repository mock.
 */

export interface PreorderPolicy {
  preorderEnabled: boolean;
  /** How many may be sold beyond real stock, across the product. */
  preorderLimit: number;
  preorderShipsAt?: string | null;
}

export interface VariantAvailability {
  stock: number;
  preorderedCount: number;
  isActive: boolean;
}

export type Availability =
  | { kind: 'in_stock'; max: number }
  /** Buyable, but not made yet — the customer is told the ship date. */
  | { kind: 'preorder'; max: number; shipsAt?: string | null }
  | { kind: 'unavailable'; reason: string };

/**
 * How many units of one size a customer may put in a basket right now.
 *
 * Real stock is always offered first; pre-order capacity is only what is left
 * of the limit after everything already promised. A product with pre-orders
 * enabled but a limit of zero sells nothing beyond stock — treating 0 as
 * "unlimited" would be a way to oversell by accident.
 */
export function availability(
  variant: VariantAvailability,
  policy: PreorderPolicy,
): Availability {
  if (!variant.isActive) {
    return { kind: 'unavailable', reason: 'That size is no longer sold.' };
  }
  if (variant.stock > 0) {
    return { kind: 'in_stock', max: variant.stock };
  }
  if (!policy.preorderEnabled) {
    return { kind: 'unavailable', reason: 'That size is sold out.' };
  }

  const remaining = Math.max(
    0,
    policy.preorderLimit - Math.max(0, variant.preorderedCount),
  );
  if (remaining <= 0) {
    return {
      kind: 'unavailable',
      reason: 'Pre-orders are full for that size.',
    };
  }
  return {
    kind: 'preorder',
    max: remaining,
    shipsAt: policy.preorderShipsAt ?? null,
  };
}

/** True when this quantity of this size would be a pre-order rather than a sale. */
export function isPreorderLine(
  variant: VariantAvailability,
  policy: PreorderPolicy,
): boolean {
  return availability(variant, policy).kind === 'preorder';
}

// ------------------------------------------------------------ drop timing --

export interface Publishable {
  isActive: boolean;
  publishAt?: Date | string | null;
}

/**
 * Whether a product should be visible to shoppers now.
 *
 * `publishAt` in the future keeps it hidden even if someone ticked active — a
 * drop that leaks early is the failure this prevents. A product with no
 * publishAt is governed by `isActive` alone, which is every product today.
 */
export function isLive(product: Publishable, now: Date = new Date()): boolean {
  if (!product.isActive) return false;
  if (!product.publishAt) return true;
  return new Date(product.publishAt).getTime() <= now.getTime();
}

/** Milliseconds until a drop opens, or null when it is already open. */
export function msUntilDrop(
  product: Publishable,
  now: Date = new Date(),
): number | null {
  if (!product.publishAt) return null;
  const at = new Date(product.publishAt).getTime();
  const delta = at - now.getTime();
  return delta > 0 ? delta : null;
}
