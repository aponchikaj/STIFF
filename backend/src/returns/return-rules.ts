import type { Order, OrderStatus } from '../orders/order.entity';
import type { ReturnStatus } from './return-request.entity';

/**
 * When a customer may cancel or return, as pure functions.
 *
 * Kept out of the service so the rules can be tested directly — these are the
 * decisions a customer will argue with, and "why was I not allowed to send
 * this back" needs an answer that does not depend on reading a repository
 * mock.
 */

export const DEFAULT_RETURN_WINDOW_DAYS = 14;
export const DEFAULT_CANCELLABLE: OrderStatus[] = ['pending', 'paid'];

const DAY_MS = 24 * 60 * 60 * 1000;

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

export function parseWindowDays(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0
    ? Math.floor(n)
    : DEFAULT_RETURN_WINDOW_DAYS;
}

export interface CancelCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * A customer may call off an order until the shop has acted on it.
 *
 * Once it is packed, someone has physically pulled the stock, so it becomes a
 * return rather than a cancellation.
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
          ? 'This order has arrived — request a return instead.'
          : 'This order is already being prepared. Contact us and we will sort it out.',
    };
  }
  return { allowed: true };
}

export interface ReturnCheck {
  allowed: boolean;
  reason?: string;
  /** Last moment a request would be accepted, when there is one. */
  closesAt?: Date;
}

/**
 * Returns open when the parcel arrives and close a fixed number of days later.
 *
 * An order with no `deliveredAt` has not arrived yet, so there is nothing to
 * send back — that is a cancellation question, not a return one.
 */
export function canRequestReturn(
  order: Pick<Order, 'status' | 'deliveredAt'>,
  windowDays: number = DEFAULT_RETURN_WINDOW_DAYS,
  now: Date = new Date(),
): ReturnCheck {
  if (order.status === 'cancelled') {
    return { allowed: false, reason: 'This order was cancelled.' };
  }
  if (order.status !== 'delivered' || !order.deliveredAt) {
    return {
      allowed: false,
      reason: 'You can request a return once your order has arrived.',
    };
  }

  const closesAt = new Date(order.deliveredAt.getTime() + windowDays * DAY_MS);
  if (now.getTime() > closesAt.getTime()) {
    return {
      allowed: false,
      reason: `The ${windowDays}-day return window closed on ${closesAt.toISOString().slice(0, 10)}.`,
      closesAt,
    };
  }
  return { allowed: true, closesAt };
}

/**
 * The state machine. Anything not listed here is not a legal move — which is
 * what stops a rejected return being quietly refunded later.
 */
const TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['received', 'rejected'],
  received: ['refunded', 'rejected'],
  rejected: [],
  refunded: [],
};

export function canTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: ReturnStatus): ReturnStatus[] {
  return TRANSITIONS[from];
}

/** Terminal states — the request is done and will not move again. */
export function isResolved(status: ReturnStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
