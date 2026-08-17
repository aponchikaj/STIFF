import {
  mapFromTotal,
  normalizeStockMap,
  stockForSize,
  sumStock,
} from './stock';

describe('stock helpers', () => {
  it('drops invalid keys and floors quantities', () => {
    expect(
      normalizeStockMap({ S: 2.9, M: '3', L: -1, '': 4, XL: Number.NaN }),
    ).toEqual({ S: 2, M: 3 });
  });

  it('sums a size map', () => {
    expect(sumStock({ S: 2, M: 3, L: 0 })).toBe(5);
  });

  it('uses total stock when the product has no sizes', () => {
    expect(
      stockForSize({ stock: 7, sizes: [], stockBySize: { S: 1 } }, 'S'),
    ).toBe(7);
  });

  it('reads per-size stock and treats missing sizes as zero', () => {
    const product = { stock: 5, sizes: ['S', 'M'], stockBySize: { S: 5 } };
    expect(stockForSize(product, 'S')).toBe(5);
    expect(stockForSize(product, 'M')).toBe(0);
  });

  it('parks a total on the first size', () => {
    expect(mapFromTotal(['S', 'M', 'L'], 10)).toEqual({ S: 10, M: 0, L: 0 });
    expect(mapFromTotal([], 10)).toEqual({});
  });
});
