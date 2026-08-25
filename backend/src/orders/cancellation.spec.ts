import type { Order } from './order.entity';
import {
  DEFAULT_CANCELLABLE,
  canCancel,
  parseCancellableStatuses,
} from './cancellation';

function order(over: Partial<Order> = {}): Order {
  return { status: 'pending', ...over } as Order;
}

describe('canCancel', () => {
  it('allows a customer to call off an order nobody has touched yet', () => {
    expect(canCancel(order({ status: 'pending' })).allowed).toBe(true);
    expect(canCancel(order({ status: 'paid' })).allowed).toBe(true);
  });

  it('refuses once the stock has been physically pulled', () => {
    const packed = canCancel(order({ status: 'packed' }));
    expect(packed.allowed).toBe(false);
    expect(packed.reason).toContain('already being prepared');
  });

  it('refuses an order that has already arrived', () => {
    const result = canCancel(order({ status: 'delivered' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('already arrived');
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

describe('parseCancellableStatuses', () => {
  it('reads the admin list', () => {
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
});
