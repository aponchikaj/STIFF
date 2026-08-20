import type { CartItem } from './cart-item.entity';
import { unitPriceFor } from './cart.service';

/**
 * Guards the one invariant that matters here: what the cart quotes must equal
 * what checkout charges. `OrdersService.placeOrder` prices a line the same way
 * — through `priceForSize` — so these cases pin both.
 */
function line(priceCents: number, size: string, delta?: number): CartItem {
  return {
    size,
    quantity: 1,
    product: { priceCents },
    variant: delta === undefined ? null : { size, priceDeltaCents: delta },
  } as unknown as CartItem;
}

describe('cart line pricing', () => {
  it('is the plain product price when the size carries no delta', () => {
    expect(unitPriceFor(line(50000, 'M', 0))).toBe(50000);
  });

  it('adds a positive delta — the bug that shipped a cart quoting less than checkout', () => {
    expect(unitPriceFor(line(50000, 'XL', 500))).toBe(50500);
  });

  it('applies a negative delta', () => {
    expect(unitPriceFor(line(50000, 'S', -1000))).toBe(49000);
  });

  it('falls back to the product price when the variant was not loaded', () => {
    // Better to quote the base price than to crash or quote zero.
    expect(unitPriceFor(line(50000, 'M'))).toBe(50000);
  });

  it('prices a one-size product', () => {
    expect(unitPriceFor(line(2500, '', 0))).toBe(2500);
  });
});
