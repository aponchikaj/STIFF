export type StockBySize = Record<string, number>;

export function normalizeStockMap(raw: unknown): StockBySize {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: StockBySize = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const size = key.trim();
    const qty = typeof value === 'number' ? value : Number(value);
    if (!size || !Number.isFinite(qty) || qty < 0) continue;
    out[size] = Math.floor(qty);
  }
  return out;
}

export function sumStock(map: StockBySize): number {
  return Object.values(map).reduce((sum, qty) => sum + qty, 0);
}

export function stockForSize(
  product: { stock: number; stockBySize?: StockBySize | null; sizes: string[] },
  size: string,
): number {
  const map = product.stockBySize ?? {};
  if (product.sizes.length === 0) return product.stock;
  return map[size] ?? 0;
}

/** Put a single-stock number onto the first size so old admin forms still work. */
export function mapFromTotal(sizes: string[], total: number): StockBySize {
  if (sizes.length === 0) return {};
  const map: StockBySize = {};
  for (const size of sizes) map[size] = 0;
  map[sizes[0]] = Math.max(0, total);
  return map;
}
