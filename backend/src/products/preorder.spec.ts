import {
  availability,
  isLive,
  isPreorderLine,
  msUntilDrop,
  type PreorderPolicy,
  type VariantAvailability,
} from './preorder';

const OFF: PreorderPolicy = { preorderEnabled: false, preorderLimit: 0 };
const ON: PreorderPolicy = {
  preorderEnabled: true,
  preorderLimit: 10,
  preorderShipsAt: '2026-10-01',
};

function variant(over: Partial<VariantAvailability> = {}): VariantAvailability {
  return { stock: 0, preorderedCount: 0, isActive: true, ...over };
}

describe('availability', () => {
  it('sells real stock first, and caps at it', () => {
    expect(availability(variant({ stock: 3 }), OFF)).toEqual({
      kind: 'in_stock',
      max: 3,
    });
  });

  it('prefers real stock even when pre-orders are on', () => {
    // Otherwise a shop with stock on the shelf would still promise a ship date.
    expect(availability(variant({ stock: 2 }), ON).kind).toBe('in_stock');
  });

  it('is unavailable when sold out and pre-orders are off', () => {
    const result = availability(variant({ stock: 0 }), OFF);
    expect(result).toEqual({
      kind: 'unavailable',
      reason: 'That size is sold out.',
    });
  });

  it('offers a pre-order when sold out and enabled', () => {
    expect(availability(variant({ stock: 0 }), ON)).toEqual({
      kind: 'preorder',
      max: 10,
      shipsAt: '2026-10-01',
    });
  });

  it('counts down the limit as pre-orders are taken', () => {
    expect(availability(variant({ preorderedCount: 7 }), ON)).toEqual({
      kind: 'preorder',
      max: 3,
      shipsAt: '2026-10-01',
    });
  });

  it('closes pre-orders once the limit is reached', () => {
    const result = availability(variant({ preorderedCount: 10 }), ON);
    expect(result).toEqual({
      kind: 'unavailable',
      reason: 'Pre-orders are full for that size.',
    });
  });

  it('does not go negative if the count somehow overshoots', () => {
    expect(availability(variant({ preorderedCount: 99 }), ON).kind).toBe(
      'unavailable',
    );
  });

  it('sells nothing beyond stock when the limit is zero', () => {
    // 0 must mean none, not unlimited — the opposite reading oversells.
    const policy: PreorderPolicy = { preorderEnabled: true, preorderLimit: 0 };
    expect(availability(variant({ stock: 0 }), policy).kind).toBe(
      'unavailable',
    );
  });

  it('refuses a retired size regardless of stock or pre-orders', () => {
    expect(availability(variant({ stock: 99, isActive: false }), ON)).toEqual({
      kind: 'unavailable',
      reason: 'That size is no longer sold.',
    });
  });
});

describe('isPreorderLine', () => {
  it('is true only when the sale is against stock that does not exist', () => {
    expect(isPreorderLine(variant({ stock: 0 }), ON)).toBe(true);
    expect(isPreorderLine(variant({ stock: 5 }), ON)).toBe(false);
    expect(isPreorderLine(variant({ stock: 0 }), OFF)).toBe(false);
  });
});

describe('isLive', () => {
  const now = new Date('2026-06-15T12:00:00Z');

  it('shows an active product with no schedule', () => {
    expect(isLive({ isActive: true }, now)).toBe(true);
  });

  it('hides an inactive product whatever the schedule says', () => {
    expect(
      isLive({ isActive: false, publishAt: '2026-01-01T00:00:00Z' }, now),
    ).toBe(false);
  });

  it('hides an active product until its moment', () => {
    // A drop leaking early is the failure this prevents.
    expect(
      isLive({ isActive: true, publishAt: '2026-07-01T00:00:00Z' }, now),
    ).toBe(false);
  });

  it('shows it once the moment has passed', () => {
    expect(
      isLive({ isActive: true, publishAt: '2026-06-01T00:00:00Z' }, now),
    ).toBe(true);
  });

  it('shows it exactly on the moment', () => {
    expect(
      isLive({ isActive: true, publishAt: '2026-06-15T12:00:00Z' }, now),
    ).toBe(true);
  });
});

describe('msUntilDrop', () => {
  const now = new Date('2026-06-15T12:00:00Z');

  it('counts down to a future drop', () => {
    expect(
      msUntilDrop({ isActive: true, publishAt: '2026-06-15T13:00:00Z' }, now),
    ).toBe(60 * 60 * 1000);
  });

  it('is null once the drop has opened', () => {
    expect(
      msUntilDrop({ isActive: true, publishAt: '2026-06-15T11:00:00Z' }, now),
    ).toBeNull();
  });

  it('is null when there is no schedule', () => {
    expect(msUntilDrop({ isActive: true }, now)).toBeNull();
  });
});
