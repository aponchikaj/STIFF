import type { Order, OrderStatus } from './order.entity';

/**
 * When a customer may call off an order, as pure functions.
 *
 * Kept out of the service so the rules can be tested directly — these are the
 * decisions a customer will argue with, and "why was I not allowed to cancel"
 * needs an answer that does not depend on reading a repository mock.
 */

export const DEFAULT_CANCELLABLE: OrderStatus[] = ['pending', 'paid'];

/** Parses the admin's comma-separated list, ignoring anything unrecognised. */
export function parseCancellableStatuses(
  raw: string | undefined,
): OrderStatus[] {
  if (!raw) return DEFAULT_CANCELLABLE;
  const valid: OrderStatus[] = [
    'pending',
    'paid',
    'packed',
    'shipped',
    'delivered',
    'cancelled',
  ];
  const parsed = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is OrderStatus => (valid as string[]).includes(s));
  return parsed.length > 0 ? parsed : DEFAULT_CANCELLABLE;
}

export interface CancelCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * A customer may call off an order until the shop has acted on it.
 *
 * Once it is packed, someone has physically pulled the stock, so it is too
 * late to call it off — that becomes a conversation with the shop.
 */
export function canCancel(
  order: Pick<Order, 'status'>,
  cancellable: OrderStatus[] = DEFAULT_CANCELLABLE,
): CancelCheck {
  if (order.status === 'cancelled') {
    return { allowed: false, reason: 'This order is already cancelled.' };
  }
  if (!cancellable.includes(order.status)) {
    return {
      allowed: false,
      reason:
        order.status === 'delivered'
          ? 'This order has already arrived.'
          : 'This order is already being prepared. Contact us and we will sort it out.',
    };
  }
  return { allowed: true };
}
