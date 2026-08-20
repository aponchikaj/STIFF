/**
 * Mirrors `backend/src/products/preorder.ts`.
 *
 * The server decides what may actually be bought; this exists so the page can
 * say the same thing without a round trip.
 */

export interface VariantAvailability {
  stock: number;
  preorderedCount?: number;
  isActive: boolean;
}

export interface PreorderPolicy {
  preorderEnabled?: boolean;
  preorderLimit?: number;
  preorderShipsAt?: string | null;
}

export type Availability =
  | { kind: "in_stock"; max: number }
  | { kind: "preorder"; max: number; shipsAt?: string | null }
  | { kind: "unavailable"; reason: string };

export function availability(
  variant: VariantAvailability,
  policy: PreorderPolicy,
): Availability {
  if (!variant.isActive) {
    return { kind: "unavailable", reason: "That size is no longer sold." };
  }
  if (variant.stock > 0) return { kind: "in_stock", max: variant.stock };
  if (!policy.preorderEnabled) {
    return { kind: "unavailable", reason: "That size is sold out." };
  }
  const remaining = Math.max(
    0,
    (policy.preorderLimit ?? 0) - Math.max(0, variant.preorderedCount ?? 0),
  );
  if (remaining <= 0) {
    return { kind: "unavailable", reason: "Pre-orders are full for that size." };
  }
  return {
    kind: "preorder",
    max: remaining,
    shipsAt: policy.preorderShipsAt ?? null,
  };
}

/** Milliseconds until a drop opens, or null when it is already open. */
export function msUntilDrop(
  publishAt: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!publishAt) return null;
  const delta = new Date(publishAt).getTime() - now;
  return delta > 0 ? delta : null;
}

/** "2d 04:11:59" — the shape a countdown wants. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}
