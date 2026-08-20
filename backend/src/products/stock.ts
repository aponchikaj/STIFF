/**
 * Stock helpers over variants.
 *
 * `stockForSize` and `sumStock` keep the names and shapes they had when stock
 * was a jsonb map, so callers and `stock.spec.ts` did not have to change when
 * the storage did.
 */

/** The size label a one-size product's single variant carries. */
export const ONE_SIZE = '';

export interface VariantLike {
  size: string;
  stock: number;
  isActive?: boolean;
  priceDeltaCents?: number;
}

export interface HasVariants {
  variants?: VariantLike[] | null;
}

/** Only a variant that is active and in stock can be sold. */
export function sellable(variant: VariantLike): boolean {
  return variant.isActive !== false && variant.stock > 0;
}

export function findVariant(
  product: HasVariants,
  size: string | null | undefined,
): VariantLike | null {
  const variants = product.variants ?? [];
  const wanted = size ?? ONE_SIZE;
  return variants.find((v) => v.size === wanted) ?? null;
}

/** Units available in one size. Unknown or retired sizes are zero, not an error. */
export function stockForSize(
  product: HasVariants,
  size: string | null | undefined,
): number {
  const variant = findVariant(product, size);
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

/** The sizes a shopper may actually pick, in the admin's order. */
export function sellableSizes(product: HasVariants): string[] {
  return [...(product.variants ?? [])]
    .filter((v) => v.isActive !== false)
    .map((v) => v.size);
}

/** Price of one unit in a given size, including any per-size delta. */
export function priceForSize(
  product: HasVariants & { priceCents: number },
  size: string | null | undefined,
): number {
  const variant = findVariant(product, size);
  return product.priceCents + (variant?.priceDeltaCents ?? 0);
}

/**
 * Normalises whatever the admin form sent into rows we can save.
 *
 * Drops entries with no usable size, floors quantities, and collapses
 * duplicate size labels onto the last one wins — the unique index would reject
 * duplicates anyway, and failing a whole product save over a typo'd repeat is
 * worse than taking the last value.
 */
export interface VariantInput {
  id?: string;
  size?: string;
  sku?: string | null;
  stock?: number | string;
  priceDeltaCents?: number | string;
  isActive?: boolean;
}

export interface NormalizedVariant {
  id?: string;
  size: string;
  sku: string | null;
  stock: number;
  priceDeltaCents: number;
  position: number;
  isActive: boolean;
}

export function normalizeVariants(
  raw: VariantInput[] | undefined,
  { allowOneSize = true }: { allowOneSize?: boolean } = {},
): NormalizedVariant[] {
  if (!Array.isArray(raw)) return [];
  const bySize = new Map<string, NormalizedVariant>();

  raw.forEach((entry) => {
    const size = (entry.size ?? '').trim();
    if (!size && !allowOneSize) return;

    const stock = Math.max(0, Math.floor(toNumber(entry.stock)));
    const delta = Math.round(toNumber(entry.priceDeltaCents));
    const sku = typeof entry.sku === 'string' ? entry.sku.trim() : '';

    bySize.set(size, {
      id: entry.id,
      size,
      sku: sku || null,
      stock,
      priceDeltaCents: delta,
      position: bySize.get(size)?.position ?? bySize.size,
      isActive: entry.isActive !== false,
    });
  });

  return [...bySize.values()].map((v, i) => ({ ...v, position: i }));
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}
