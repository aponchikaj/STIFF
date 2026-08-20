import {
  NO_COLOUR,
  ONE_SIZE,
  colourways,
  findVariant,
  hasColourways,
  normalizeHex,
  isSoldOut,
  normalizeVariants,
  priceForSize,
  sellable,
  sellableSizes,
  stockForSize,
  sumStock,
  variantKey,
  type VariantLike,
} from './stock';

function v(
  size: string,
  stock: number,
  extra: Partial<VariantLike> = {},
): VariantLike {
  return { size, stock, ...extra };
}

describe('stock helpers', () => {
  describe('stockForSize', () => {
    it('reads the matching variant', () => {
      const product = { variants: [v('S', 5), v('M', 2)] };
      expect(stockForSize(product, 'S')).toBe(5);
      expect(stockForSize(product, 'M')).toBe(2);
    });

    it('treats an unknown size as zero rather than throwing', () => {
      expect(stockForSize({ variants: [v('S', 5)] }, 'XL')).toBe(0);
    });

    it('treats a retired size as zero even while it still holds stock', () => {
      // Deactivating is how a size is withdrawn without losing order history,
      // so it must not remain buyable.
      const product = { variants: [v('S', 5, { isActive: false })] };
      expect(stockForSize(product, 'S')).toBe(0);
    });

    it('falls back to the one-size variant when no size is given', () => {
      const product = { variants: [v(ONE_SIZE, 7)] };
      expect(stockForSize(product, null)).toBe(7);
      expect(stockForSize(product, undefined)).toBe(7);
      expect(stockForSize(product, '')).toBe(7);
    });

    it('is zero when variants were never loaded, not a crash', () => {
      expect(stockForSize({}, 'S')).toBe(0);
      expect(stockForSize({ variants: null }, 'S')).toBe(0);
    });

    it('never reports negative stock', () => {
      expect(stockForSize({ variants: [v('S', -3)] }, 'S')).toBe(0);
    });
  });

  describe('sumStock', () => {
    it('adds every variant', () => {
      expect(sumStock([v('S', 2), v('M', 3), v('L', 0)])).toBe(5);
    });

    it('is zero for no variants', () => {
      expect(sumStock([])).toBe(0);
    });

    it('counts retired sizes — they are still physically in the room', () => {
      expect(sumStock([v('S', 2, { isActive: false })])).toBe(2);
    });
  });

  describe('sellable / isSoldOut', () => {
    it('needs both active and in stock', () => {
      expect(sellable(v('S', 1))).toBe(true);
      expect(sellable(v('S', 0))).toBe(false);
      expect(sellable(v('S', 1, { isActive: false }))).toBe(false);
    });

    it('is sold out when every size is gone', () => {
      expect(isSoldOut({ variants: [v('S', 0), v('M', 0)] })).toBe(true);
      expect(isSoldOut({ variants: [v('S', 0), v('M', 1)] })).toBe(false);
    });

    it('is sold out with no variants at all', () => {
      expect(isSoldOut({ variants: [] })).toBe(true);
      expect(isSoldOut({})).toBe(true);
    });
  });

  describe('sellableSizes', () => {
    it('lists active sizes in order and omits retired ones', () => {
      const product = {
        variants: [v('S', 1), v('M', 0), v('L', 4, { isActive: false })],
      };
      // M is listed despite being empty — the picker shows it as sold out
      // rather than hiding it, so people can see the size exists.
      expect(sellableSizes(product)).toEqual(['S', 'M']);
    });
  });

  describe('priceForSize', () => {
    it('adds the variant delta to the product price', () => {
      const product = { priceCents: 50000, variants: [v('XXL', 3)] };
      expect(priceForSize({ ...product, variants: [] }, 'XXL')).toBe(50000);
      expect(
        priceForSize(
          {
            priceCents: 50000,
            variants: [{ size: 'XXL', stock: 3, priceDeltaCents: 500 }],
          },
          'XXL',
        ),
      ).toBe(50500);
    });

    it('handles a negative delta', () => {
      expect(
        priceForSize(
          {
            priceCents: 50000,
            variants: [{ size: 'S', stock: 1, priceDeltaCents: -1000 }],
          },
          'S',
        ),
      ).toBe(49000);
    });
  });

  describe('findVariant', () => {
    it('returns null rather than undefined for a miss', () => {
      expect(findVariant({ variants: [v('S', 1)] }, 'M')).toBeNull();
    });
  });

  describe('normalizeVariants', () => {
    it('floors quantities and clamps negatives to zero', () => {
      expect(
        normalizeVariants([
          { size: 'S', stock: 2.9 },
          { size: 'M', stock: -4 },
        ]),
      ).toEqual([
        expect.objectContaining({ size: 'S', stock: 2 }),
        expect.objectContaining({ size: 'M', stock: 0 }),
      ]);
    });

    it('accepts numeric strings from a form post', () => {
      expect(normalizeVariants([{ size: 'S', stock: '3' }])[0].stock).toBe(3);
    });

    it('trims sizes and blanks an empty SKU to null', () => {
      const [variant] = normalizeVariants([
        { size: '  M  ', sku: '   ', stock: 1 },
      ]);
      expect(variant.size).toBe('M');
      expect(variant.sku).toBeNull();
    });

    it('collapses a duplicated size onto the last value', () => {
      // The unique index would reject the pair anyway; failing a whole product
      // save over a typo'd repeat is the worse outcome.
      const result = normalizeVariants([
        { size: 'S', stock: 1 },
        { size: 'S', stock: 9 },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].stock).toBe(9);
    });

    it('renumbers positions so reordering survives a round trip', () => {
      const result = normalizeVariants([
        { size: 'L', stock: 1 },
        { size: 'S', stock: 1 },
        { size: 'M', stock: 1 },
      ]);
      expect(result.map((v) => [v.size, v.position])).toEqual([
        ['L', 0],
        ['S', 1],
        ['M', 2],
      ]);
    });

    it('keeps the one-size entry by default and drops it when sizes are required', () => {
      expect(normalizeVariants([{ size: '', stock: 4 }])).toHaveLength(1);
      expect(
        normalizeVariants([{ size: '', stock: 4 }], { allowOneSize: false }),
      ).toHaveLength(0);
    });

    it('defaults isActive to true but respects an explicit false', () => {
      expect(normalizeVariants([{ size: 'S', stock: 1 }])[0].isActive).toBe(
        true,
      );
      expect(
        normalizeVariants([{ size: 'S', stock: 1, isActive: false }])[0]
          .isActive,
      ).toBe(false);
    });

    it('returns nothing for a non-array payload', () => {
      expect(normalizeVariants(undefined)).toEqual([]);
    });
  });

  describe('colourways', () => {
    const jacket = {
      priceCents: 40000,
      variants: [
        { color: 'Black', colorHex: '#111111', size: 'S', stock: 2 },
        { color: 'Black', colorHex: '#111111', size: 'M', stock: 0 },
        { color: 'Bone', colorHex: '#e8e2d5', size: 'S', stock: 4 },
        {
          color: 'Bone',
          colorHex: '#e8e2d5',
          size: 'M',
          stock: 1,
          priceDeltaCents: 500,
        },
      ],
    };

    it('reads stock for one colour and size, not the first size that matches', () => {
      // The bug this guards: looking up 'S' alone finds Black and reports 2
      // units when the shopper is standing in front of the Bone one.
      expect(stockForSize(jacket, 'S', 'Black')).toBe(2);
      expect(stockForSize(jacket, 'S', 'Bone')).toBe(4);
    });

    it('prices the colourway that was picked', () => {
      expect(priceForSize(jacket, 'M', 'Bone')).toBe(40500);
      expect(priceForSize(jacket, 'M', 'Black')).toBe(40000);
    });

    it('finds nothing when a colour is required but not given', () => {
      // Not a silent fallback to the first colour: no colour means no choice
      // has been made yet, and nothing is buyable until one is.
      expect(findVariant(jacket, 'S')).toBeNull();
      expect(stockForSize(jacket, 'S')).toBe(0);
    });

    it('groups colours in variant order with their swatch and total stock', () => {
      expect(colourways(jacket)).toEqual([
        { color: 'Black', colorHex: '#111111', stock: 2, isActive: true },
        { color: 'Bone', colorHex: '#e8e2d5', stock: 5, isActive: true },
      ]);
    });

    it('scopes the size list to one colour', () => {
      const partial = {
        variants: [
          { color: 'Black', size: 'S', stock: 1 },
          { color: 'Black', size: 'L', stock: 1 },
          { color: 'Bone', size: 'S', stock: 1 },
        ],
      };
      expect(sellableSizes(partial, 'Black')).toEqual(['S', 'L']);
      expect(sellableSizes(partial, 'Bone')).toEqual(['S']);
    });

    it('treats a colourless product exactly as it did before colourways', () => {
      const tee = { priceCents: 9000, variants: [{ size: 'S', stock: 3 }] };
      expect(hasColourways(tee)).toBe(false);
      expect(stockForSize(tee, 'S')).toBe(3);
      expect(colourways(tee)).toEqual([
        { color: NO_COLOUR, colorHex: null, stock: 3, isActive: true },
      ]);
    });

    it('marks a colour inactive only when every size in it is retired', () => {
      const retired = {
        variants: [
          { color: 'Bone', size: 'S', stock: 1, isActive: false },
          { color: 'Bone', size: 'M', stock: 1, isActive: false },
          { color: 'Black', size: 'S', stock: 1, isActive: false },
          { color: 'Black', size: 'M', stock: 1, isActive: true },
        ],
      };
      expect(colourways(retired).map((c) => [c.color, c.isActive])).toEqual([
        ['Bone', false],
        ['Black', true],
      ]);
    });
  });

  describe('normalizeHex', () => {
    it('accepts both lengths and normalises to lowercase #rrggbb', () => {
      expect(normalizeHex('#FFF')).toBe('#ffffff');
      expect(normalizeHex('e8e2d5')).toBe('#e8e2d5');
      expect(normalizeHex('  #E8E2D5  ')).toBe('#e8e2d5');
    });

    it('is null for anything the CHECK constraint would reject', () => {
      // Null rather than a throw: a bad swatch should cost the chip, not the
      // whole product save.
      expect(normalizeHex('bone')).toBeNull();
      expect(normalizeHex('#12345')).toBeNull();
      expect(normalizeHex('')).toBeNull();
      expect(normalizeHex(undefined)).toBeNull();
    });
  });

  describe('normalizeVariants with colour', () => {
    it('keeps one row per colour and size rather than collapsing on size', () => {
      const rows = normalizeVariants([
        { color: 'Black', size: 'S', stock: 1 },
        { color: 'Bone', size: 'S', stock: 2 },
      ]);
      expect(rows).toHaveLength(2);
      expect(rows.map((v) => [v.color, v.stock])).toEqual([
        ['Black', 1],
        ['Bone', 2],
      ]);
    });

    it('still collapses a genuine duplicate pair onto the last value', () => {
      const rows = normalizeVariants([
        { color: 'Bone', size: 'S', stock: 1 },
        { color: 'Bone', size: 'S', stock: 9 },
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0].stock).toBe(9);
    });

    it('trims the colour and normalises its swatch', () => {
      const [row] = normalizeVariants([
        { color: '  Bone  ', colorHex: 'E8E2D5', size: 'S', stock: 1 },
      ]);
      expect(row.color).toBe('Bone');
      expect(row.colorHex).toBe('#e8e2d5');
    });

    it('drops empty entries from a colourway image list', () => {
      const [row] = normalizeVariants([
        { color: 'Bone', size: 'S', stock: 1, images: ['a.jpg', ''] },
      ]);
      expect(row.images).toEqual(['a.jpg']);
    });

    it('cannot be tricked into a key collision by a punctuated label', () => {
      // The separator is a NUL, which no varchar column can hold — so no
      // typed-in label can forge a collision with another pair.
      expect(variantKey('Bone', 'S')).not.toBe(variantKey('Bone S', ''));
      expect(variantKey('Bone-S', '')).not.toBe(variantKey('Bone', '-S'));
    });
  });
});
