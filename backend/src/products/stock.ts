/**
 * Stock helpers over variants.
 *
 * `stockForSize` and `sumStock` keep the names and shapes they had when stock
 * was a jsonb map, so callers and `stock.spec.ts` did not have to change when
 * the storage did. Colour was added the same way: every lookup takes an
 * optional colour that defaults to the colourless variant, so a product with
 * one colourway reads exactly as it did before colourways existed.
 */

/** The size label a one-size product's single variant carries. */
export const ONE_SIZE = '';

/** The colour label a product with no colourways carries. */
export const NO_COLOUR = '';

export interface VariantLike {
  size: string;
  stock: number;
  color?: string;
  isActive?: boolean;
  priceDeltaCents?: number;
}

export interface HasVariants {
  variants?: VariantLike[] | null;
}

/** Missing colour and the empty string are the same thing everywhere. */
export function colourOf(variant: { color?: string | null }): string {
  return variant.color ?? NO_COLOUR;
}

/** Only a variant that is active and in stock can be sold. */
export function sellable(variant: VariantLike): boolean {
  return variant.isActive !== false && variant.stock > 0;
}

export function findVariant(
  product: HasVariants,
  size: string | null | undefined,
  color?: string | null,
): VariantLike | null {
  const variants = product.variants ?? [];
  const wantedSize = size ?? ONE_SIZE;
  const wantedColour = color ?? NO_COLOUR;
  return (
    variants.find(
      (v) => v.size === wantedSize && colourOf(v) === wantedColour,
    ) ?? null
  );
}

/** Units available in one size. Unknown or retired sizes are zero, not an error. */
export function stockForSize(
  product: HasVariants,
  size: string | null | undefined,
  color?: string | null,
): number {
  const variant = findVariant(product, size, color);
  if (!variant || variant.isActive === false) return 0;
  return Math.max(variant.stock, 0);
}

/** Total across every variant — what `products.stock` is kept equal to. */
export function sumStock(variants: VariantLike[]): number {
  return variants.reduce((total, v) => total + Math.max(v.stock, 0), 0);
}

/** True when nothing at all can be bought. */
export function isSoldOut(product: HasVariants): boolean {
  return !(product.variants ?? []).some(sellable);
}

/**
 * The sizes a shopper may actually pick, in the admin's order.
 *
 * Scoped to one colourway when asked, because "which sizes exist" is a
 * different question per colour — the Bone run may stop at L.
 */
export function sellableSizes(
  product: HasVariants,
  color?: string | null,
): string[] {
  const wanted = color ?? null;
  return [...(product.variants ?? [])]
    .filter((v) => v.isActive !== false)
    .filter((v) => wanted === null || colourOf(v) === wanted)
    .map((v) => v.size);
}

/** True when this product is actually sold in more than one colour. */
export function hasColourways(product: HasVariants): boolean {
  return (product.variants ?? []).some((v) => colourOf(v) !== NO_COLOUR);
}

export interface Colourway {
  color: string;
  colorHex: string | null;
  /** Units left across every size in this colour. */
  stock: number;
  /** False when every size in this colour is retired. */
  isActive: boolean;
}

/**
 * The colours to offer, in the admin's variant order.
 *
 * Derived from the variants rather than stored on the product, so there is no
 * second list to keep in step with the rows that hold the stock.
 */
export function colourways(
  product: HasVariants & {
    variants?: (VariantLike & { colorHex?: string | null })[] | null;
  },
): Colourway[] {
  const byColour = new Map<string, Colourway>();
  for (const variant of product.variants ?? []) {
    const color = colourOf(variant);
    const current = byColour.get(color);
    const stock = Math.max(variant.stock, 0);
    if (current) {
      current.stock += stock;
      current.isActive ||= variant.isActive !== false;
      current.colorHex ??= variant.colorHex ?? null;
    } else {
      byColour.set(color, {
        color,
        colorHex: variant.colorHex ?? null,
        stock,
        isActive: variant.isActive !== false,
      });
    }
  }
  return [...byColour.values()];
}

/** Price of one unit in a given size, including any per-size delta. */
export function priceForSize(
  product: HasVariants & { priceCents: number },
  size: string | null | undefined,
  color?: string | null,
): number {
  const variant = findVariant(product, size, color);
  return product.priceCents + (variant?.priceDeltaCents ?? 0);
}

/**
 * Normalises whatever the admin form sent into rows we can save.
 *
 * Drops entries with no usable size, floors quantities, and collapses
 * duplicate (colour, size) pairs onto the last one wins — the unique index
 * would reject duplicates anyway, and failing a whole product save over a
 * typo'd repeat is worse than taking the last value.
 */
export interface VariantInput {
  id?: string;
  size?: string;
  color?: string;
  colorHex?: string | null;
  images?: string[];
  sku?: string | null;
  stock?: number | string;
  priceDeltaCents?: number | string;
  isActive?: boolean;
}

export interface NormalizedVariant {
  id?: string;
  size: string;
  color: string;
  colorHex: string | null;
  images: string[];
  sku: string | null;
  stock: number;
  priceDeltaCents: number;
  position: number;
  isActive: boolean;
}

/** `#abc` and `abcdef` both mean the same swatch; the CHECK wants `#abcdef`. */
export function normalizeHex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().replace(/^#/, '');
  const expanded =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  return /^[0-9a-fA-F]{6}$/.test(expanded) ? `#${expanded.toLowerCase()}` : null;
}

/**
 * Identity of a variant row within one product.
 *
 * Joined with a NUL, because Postgres `varchar` accepts every other byte a
 * colour or size label might contain. Any printable separator could be typed
 * into a label and forge a collision; this one cannot be stored at all.
 */
export function variantKey(color: string, size: string): string {
  return `${color}\u0000${size}`;
}

export function normalizeVariants(
  raw: VariantInput[] | undefined,
  { allowOneSize = true }: { allowOneSize?: boolean } = {},
): NormalizedVariant[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, NormalizedVariant>();

  raw.forEach((entry) => {
    const size = (entry.size ?? '').trim();
    if (!size && !allowOneSize) return;

    const color = (entry.color ?? '').trim();
    const stock = Math.max(0, Math.floor(toNumber(entry.stock)));
    const delta = Math.round(toNumber(entry.priceDeltaCents));
    const sku = typeof entry.sku === 'string' ? entry.sku.trim() : '';
    const key = variantKey(color, size);

    byKey.set(key, {
      id: entry.id,
      size,
      color,
      colorHex: normalizeHex(entry.colorHex),
      images: Array.isArray(entry.images)
        ? entry.images.filter(
            (url): url is string => typeof url === 'string' && url !== '',
          )
        : [],
      sku: sku || null,
      stock,
      priceDeltaCents: delta,
      position: byKey.get(key)?.position ?? byKey.size,
      isActive: entry.isActive !== false,
    });
  });

  return [...byKey.values()].map((v, i) => ({ ...v, position: i }));
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}
