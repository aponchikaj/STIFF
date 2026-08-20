import {
  normalizeCode,
  priceOrder,
  usageProblem,
  windowProblem,
} from './pricing';

const BASE = { subtotalCents: 10000, shippingCents: 500 };

describe('priceOrder', () => {
  it('adds shipping to the subtotal when nothing is applied', () => {
    expect(priceOrder(BASE)).toEqual({
      subtotalCents: 10000,
      discountCents: 0,
      shippingCents: 500,
      giftCardCents: 0,
      totalCents: 10500,
    });
  });

  describe('percent codes', () => {
    it('takes the cut off goods only, never off shipping', () => {
      // The whole reason discount comes before shipping in the pipeline: a
      // 100% code must not also post the parcel for free.
      const result = priceOrder({
        ...BASE,
        discount: { kind: 'percent', value: 100, minSubtotalCents: 0 },
      });
      expect(result.discountCents).toBe(10000);
      expect(result.shippingCents).toBe(500);
      expect(result.totalCents).toBe(500);
    });

    it('rounds to whole minor units', () => {
      const result = priceOrder({
        subtotalCents: 999,
        shippingCents: 0,
        discount: { kind: 'percent', value: 15, minSubtotalCents: 0 },
      });
      expect(result.discountCents).toBe(150);
      expect(Number.isInteger(result.totalCents)).toBe(true);
    });

    it('clamps a nonsense percentage instead of paying the customer', () => {
      const result = priceOrder({
        ...BASE,
        discount: { kind: 'percent', value: 900, minSubtotalCents: 0 },
      });
      expect(result.discountCents).toBe(10000);
      expect(result.totalCents).toBe(500);
    });
  });

  describe('fixed codes', () => {
    it('takes a flat amount off', () => {
      const result = priceOrder({
        ...BASE,
        discount: { kind: 'fixed', value: 2500, minSubtotalCents: 0 },
      });
      expect(result.discountCents).toBe(2500);
      expect(result.totalCents).toBe(8000);
    });

    it('never exceeds the goods, so it cannot quietly pay for shipping', () => {
      const result = priceOrder({
        ...BASE,
        discount: { kind: 'fixed', value: 99999, minSubtotalCents: 0 },
      });
      expect(result.discountCents).toBe(10000);
      expect(result.totalCents).toBe(500);
    });

    it('never produces a negative total', () => {
      const result = priceOrder({
        subtotalCents: 100,
        shippingCents: 0,
        discount: { kind: 'fixed', value: 99999, minSubtotalCents: 0 },
      });
      expect(result.totalCents).toBe(0);
    });
  });

  describe('free shipping codes', () => {
    it('zeroes the postage and leaves the goods alone', () => {
      const result = priceOrder({
        ...BASE,
        discount: { kind: 'free_shipping', value: 0, minSubtotalCents: 0 },
      });
      expect(result.discountCents).toBe(0);
      expect(result.shippingCents).toBe(0);
      expect(result.totalCents).toBe(10000);
    });

    it('is harmless on an order that was already collecting in person', () => {
      const result = priceOrder({
        subtotalCents: 10000,
        shippingCents: 0,
        discount: { kind: 'free_shipping', value: 0, minSubtotalCents: 0 },
      });
      expect(result.totalCents).toBe(10000);
    });
  });

  describe('minimum subtotal', () => {
    it('applies at exactly the minimum', () => {
      const result = priceOrder({
        ...BASE,
        discount: { kind: 'fixed', value: 1000, minSubtotalCents: 10000 },
      });
      expect(result.discountCents).toBe(1000);
    });

    it('is ignored below the minimum rather than partially applied', () => {
      const result = priceOrder({
        subtotalCents: 9999,
        shippingCents: 500,
        discount: { kind: 'fixed', value: 1000, minSubtotalCents: 10000 },
      });
      expect(result.discountCents).toBe(0);
      expect(result.totalCents).toBe(10499);
    });
  });

  describe('gift cards', () => {
    it('pays whatever is left, including the postage', () => {
      // A card is money, not a rule — unlike a percentage it may cover
      // shipping, which is why it is applied last.
      const result = priceOrder({ ...BASE, giftCardBalanceCents: 20000 });
      expect(result.giftCardCents).toBe(10500);
      expect(result.totalCents).toBe(0);
    });

    it('spends only what the order needs, leaving the rest on the card', () => {
      const result = priceOrder({ ...BASE, giftCardBalanceCents: 30000 });
      expect(result.giftCardCents).toBe(10500);
    });

    it('covers part of an order when the balance is short', () => {
      const result = priceOrder({ ...BASE, giftCardBalanceCents: 3000 });
      expect(result.giftCardCents).toBe(3000);
      expect(result.totalCents).toBe(7500);
    });

    it('stacks after a discount, not before it', () => {
      const result = priceOrder({
        ...BASE,
        discount: { kind: 'percent', value: 50, minSubtotalCents: 0 },
        giftCardBalanceCents: 100000,
      });
      // 10000 - 5000 + 500 = 5500 left for the card to pay.
      expect(result.discountCents).toBe(5000);
      expect(result.giftCardCents).toBe(5500);
      expect(result.totalCents).toBe(0);
    });

    it('ignores an empty or negative balance', () => {
      expect(priceOrder({ ...BASE, giftCardBalanceCents: 0 }).totalCents).toBe(
        10500,
      );
      expect(priceOrder({ ...BASE, giftCardBalanceCents: -5 }).totalCents).toBe(
        10500,
      );
    });
  });

  it('never lets any component go negative', () => {
    const result = priceOrder({ subtotalCents: -100, shippingCents: -50 });
    expect(result.subtotalCents).toBe(0);
    expect(result.shippingCents).toBe(0);
    expect(result.totalCents).toBe(0);
  });
});

describe('windowProblem', () => {
  const now = new Date('2026-06-15T12:00:00Z');

  it('passes a live code', () => {
    expect(windowProblem({ isActive: true }, now)).toBeNull();
  });

  it('catches a deactivated code', () => {
    expect(windowProblem({ isActive: false }, now)).toBe('inactive');
  });

  it('catches one that has not started', () => {
    expect(
      windowProblem(
        { isActive: true, startsAt: new Date('2026-07-01T00:00:00Z') },
        now,
      ),
    ).toBe('not_started');
  });

  it('catches an expired one', () => {
    expect(
      windowProblem(
        { isActive: true, expiresAt: new Date('2026-06-01T00:00:00Z') },
        now,
      ),
    ).toBe('expired');
  });

  it('accepts a code inside its window', () => {
    expect(
      windowProblem(
        {
          isActive: true,
          startsAt: new Date('2026-06-01T00:00:00Z'),
          expiresAt: new Date('2026-07-01T00:00:00Z'),
        },
        now,
      ),
    ).toBeNull();
  });
});

describe('usageProblem', () => {
  it('allows an unlimited code', () => {
    expect(usageProblem({ usedCount: 9999, usedByThisBuyer: 5 })).toBeNull();
  });

  it('catches a code that has hit its total cap', () => {
    expect(
      usageProblem({ usedCount: 200, usageLimit: 200, usedByThisBuyer: 0 }),
    ).toBe('exhausted');
  });

  it('catches a buyer who has used their allowance', () => {
    expect(
      usageProblem({ usedCount: 5, perUserLimit: 1, usedByThisBuyer: 1 }),
    ).toBe('already_used');
  });

  it('lets a buyer under their allowance through', () => {
    expect(
      usageProblem({ usedCount: 5, perUserLimit: 3, usedByThisBuyer: 2 }),
    ).toBeNull();
  });
});

describe('normalizeCode', () => {
  it('upper-cases and strips whitespace so a pasted code still works', () => {
    expect(normalizeCode('  stiff 10 ')).toBe('STIFF10');
    expect(normalizeCode('Stiff10')).toBe('STIFF10');
  });
});
