import { availability, isLive } from './availability';

describe('availability', () => {
  it('offers real stock', () => {
    const offer = availability({ stock: 3, isActive: true });
    expect(offer).toEqual({ kind: 'in_stock', max: 3 });
  });

  it('refuses a size that is sold out', () => {
    const offer = availability({ stock: 0, isActive: true });
    expect(offer.kind).toBe('unavailable');
  });

  it('refuses a size that is no longer sold, even with stock behind it', () => {
    const offer = availability({ stock: 5, isActive: false });
    expect(offer.kind).toBe('unavailable');
  });
});

describe('isLive', () => {
  const now = new Date('2026-01-10T00:00:00Z');

  it('hides an inactive product', () => {
    expect(isLive({ isActive: false }, now)).toBe(false);
  });

  it('shows an active product with no publish date', () => {
    expect(isLive({ isActive: true }, now)).toBe(true);
  });

  it('keeps a drop hidden until its publish date', () => {
    expect(isLive({ isActive: true, publishAt: '2026-02-01' }, now)).toBe(
      false,
    );
  });

  it('shows a drop once its publish date has passed', () => {
    expect(isLive({ isActive: true, publishAt: '2026-01-01' }, now)).toBe(true);
  });
});
