import type { Order } from '../orders/order.entity';
import {
  DEFAULT_CANCELLABLE,
  canCancel,
  canRequestReturn,
  canTransition,
  isResolved,
  nextStatuses,
  parseCancellableStatuses,
  parseWindowDays,
} from './return-rules';

const DAY = 24 * 60 * 60 * 1000;

function order(over: Partial<Order> = {}): Order {
  return { status: 'pending', deliveredAt: null, ...over } as Order;
}

describe('canCancel', () => {
  it('allows a customer to call off an order nobody has touched yet', () => {
    expect(canCancel(order({ status: 'pending' })).allowed).toBe(true);
    expect(canCancel(order({ status: 'paid' })).allowed).toBe(true);
  });

  it('refuses once the stock has been physically pulled', () => {
    // Past packed it is a return, not a cancellation.
    const packed = canCancel(order({ status: 'packed' }));
    expect(packed.allowed).toBe(false);
    expect(packed.reason).toContain('already being prepared');
  });

  it('points a delivered order at returns instead', () => {
    const result = canCancel(order({ status: 'delivered' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('request a return');
  });

  it('says so plainly when it is already cancelled', () => {
    expect(canCancel(order({ status: 'cancelled' })).reason).toContain(
      'already cancelled',
    );
  });

  it('respects an admin-widened window', () => {
    expect(
      canCancel(order({ status: 'shipped' }), ['pending', 'paid', 'shipped'])
        .allowed,
    ).toBe(true);
  });
});

describe('canRequestReturn', () => {
  const delivered = (daysAgo: number) =>
    order({
      status: 'delivered',
      deliveredAt: new Date(Date.now() - daysAgo * DAY),
    });

  it('is open the day it arrives', () => {
    expect(canRequestReturn(delivered(0)).allowed).toBe(true);
  });

  it('is still open on the last day of the window', () => {
    expect(canRequestReturn(delivered(13)).allowed).toBe(true);
  });

  it('closes after the window', () => {
    const result = canRequestReturn(delivered(15));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('14-day return window closed');
  });

  it('reports when the window shuts, so the page can say so', () => {
    const result = canRequestReturn(delivered(1));
    expect(result.closesAt).toBeInstanceOf(Date);
  });

  it('refuses before the parcel has arrived', () => {
    const result = canRequestReturn(order({ status: 'shipped' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('once your order has arrived');
  });

  it('refuses a delivered order with no delivery date recorded', () => {
    // Predates deliveredAt; without a start there is no window to measure.
    expect(
      canRequestReturn(order({ status: 'delivered', deliveredAt: null }))
        .allowed,
    ).toBe(false);
  });

  it('refuses a cancelled order', () => {
    expect(canRequestReturn(order({ status: 'cancelled' })).allowed).toBe(
      false,
    );
  });

  it('honours a custom window', () => {
    expect(canRequestReturn(delivered(20), 30).allowed).toBe(true);
    expect(canRequestReturn(delivered(20), 7).allowed).toBe(false);
  });

  it('treats a zero-day window as same-day only', () => {
    expect(canRequestReturn(delivered(0), 0).allowed).toBe(true);
    expect(canRequestReturn(delivered(1), 0).allowed).toBe(false);
  });
});

describe('return state machine', () => {
  it('walks the happy path', () => {
    expect(canTransition('requested', 'approved')).toBe(true);
    expect(canTransition('approved', 'received')).toBe(true);
    expect(canTransition('received', 'refunded')).toBe(true);
  });

  it('will not refund something that was never approved', () => {
    expect(canTransition('requested', 'refunded')).toBe(false);
  });

  it('will not reopen a rejected or refunded request', () => {
    // The reason the machine exists: a refusal must not be quietly refunded
    // later, and a refund must not be silently taken back.
    expect(canTransition('rejected', 'approved')).toBe(false);
    expect(canTransition('refunded', 'received')).toBe(false);
    expect(nextStatuses('rejected')).toEqual([]);
    expect(nextStatuses('refunded')).toEqual([]);
  });

  it('allows a reject at any live stage', () => {
    expect(canTransition('requested', 'rejected')).toBe(true);
    expect(canTransition('approved', 'rejected')).toBe(true);
    expect(canTransition('received', 'rejected')).toBe(true);
  });

  it('knows which states are finished', () => {
    expect(isResolved('refunded')).toBe(true);
    expect(isResolved('rejected')).toBe(true);
    expect(isResolved('requested')).toBe(false);
  });
});

describe('admin settings parsing', () => {
  it('reads a comma-separated status list', () => {
    expect(parseCancellableStatuses('pending, paid, packed')).toEqual([
      'pending',
      'paid',
      'packed',
    ]);
  });

  it('ignores statuses that do not exist', () => {
    expect(parseCancellableStatuses('pending, banana')).toEqual(['pending']);
  });

  it('falls back rather than locking cancellation out entirely on a typo', () => {
    expect(parseCancellableStatuses('banana')).toEqual(DEFAULT_CANCELLABLE);
    expect(parseCancellableStatuses('')).toEqual(DEFAULT_CANCELLABLE);
    expect(parseCancellableStatuses(undefined)).toEqual(DEFAULT_CANCELLABLE);
  });

  it('reads the window and falls back on nonsense', () => {
    expect(parseWindowDays('30')).toBe(30);
    expect(parseWindowDays('0')).toBe(0);
    expect(parseWindowDays('-5')).toBe(14);
    expect(parseWindowDays('abc')).toBe(14);
    expect(parseWindowDays(undefined)).toBe(14);
  });
});
