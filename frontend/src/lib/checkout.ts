/** Keep in sync with backend/src/orders/checkout.constants.ts */

export const SHIPPING_METHODS = ["pickup", "tbilisi", "regions"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export const SHIPPING_FEES_CENTS: Record<ShippingMethod, number> = {
  pickup: 0,
  tbilisi: 500,
  regions: 1000,
};

export const SHIPPING_LABELS: Record<ShippingMethod, string> = {
  pickup: "Pickup in Tbilisi",
  tbilisi: "Tbilisi courier",
  regions: "Georgia regions",
};

/**
 * Payment options are NOT listed here.
 *
 * Which methods exist, what they are called and whether each is usable depends
 * on which merchant contracts are configured on the server, so checkout asks
 * `GET /payments/methods` instead. Duplicating that list here is what let the
 * frontend claim card payments were available when nothing could take one.
 */
export type PaymentMethod =
  | "cod"
  | "bank_transfer"
  | "card_tbc"
  | "card_bog";

/**
 * Display-only label for a method already stored on an order.
 *
 * Separate from what checkout offers: this has to render historical values —
 * including `card`, used before the acquirers were split — long after those
 * options stop being selectable. Unknown values fall through to the raw key
 * rather than rendering blank.
 */
export function paymentLabel(method: string | undefined | null): string {
  switch (method) {
    case "cod":
      return "Pay on delivery";
    case "bank_transfer":
      return "Bank transfer";
    case "card_tbc":
      return "Card — TBC Bank";
    case "card_bog":
      return "Card — Bank of Georgia";
    case "card":
      return "Card";
    default:
      return method ?? "—";
  }
}

export interface VariantLike {
  id?: string;
  size: string;
  stock: number;
  color?: string;
  colorHex?: string | null;
  images?: string[];
  isActive?: boolean;
  priceDeltaCents?: number;
}

/** The colour label a product sold in one colour carries. */
export const NO_COLOUR = "";

/** Missing colour and the empty string are the same thing everywhere. */
export function colourOf(variant: { color?: string | null }): string {
  return variant.color ?? NO_COLOUR;
}

/**
 * Mirrors `backend/src/products/stock.ts`.
 *
 * A product with no sizes still has one variant with an empty size label, and
 * one sold in a single colour carries an empty colour — so both cases read the
 * same way as a four-colourway jacket.
 */
export function findVariant<T extends VariantLike>(
  product: { variants?: T[] | null },
  size: string | null,
  color?: string | null,
): T | null {
  const wantedSize = size ?? "";
  const wantedColour = color ?? NO_COLOUR;
  return (
    (product.variants ?? []).find(
      (v) => v.size === wantedSize && colourOf(v) === wantedColour,
    ) ?? null
  );
}

export function stockForSize(
  product: { variants?: VariantLike[] | null },
  size: string | null,
  color?: string | null,
): number {
  const variant = findVariant(product, size, color);
  if (!variant || variant.isActive === false) return 0;
  return Math.max(variant.stock, 0);
}

/** The sizes to render in the picker — retired ones are omitted entirely. */
export function pickableVariants<T extends VariantLike>(
  product: { variants?: T[] | null },
  color?: string | null,
): T[] {
  const wanted = color ?? null;
  return (product.variants ?? [])
    .filter((v) => v.isActive !== false)
    .filter((v) => wanted === null || colourOf(v) === wanted);
}

/** Nothing at all can be bought. */
export function isSoldOut(product: {
  variants?: VariantLike[] | null;
}): boolean {
  return !pickableVariants(product).some((v) => v.stock > 0);
}

/** Unit price for one variant, including any per-size delta. */
export function priceForSize(
  product: { priceCents: number; variants?: VariantLike[] | null },
  size: string | null,
  color?: string | null,
): number {
  const variant = findVariant(product, size, color);
  return product.priceCents + (variant?.priceDeltaCents ?? 0);
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
 * Derived from the variants rather than a second list on the product, so the
 * picker cannot drift from the rows that hold the stock.
 */
export function colourways(product: {
  variants?: VariantLike[] | null;
}): Colourway[] {
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

/** True when this product is actually sold in more than one colour. */
export function hasColourways(product: {
  variants?: VariantLike[] | null;
}): boolean {
  return (product.variants ?? []).some((v) => colourOf(v) !== NO_COLOUR);
}

/** The sizes offered in one colourway, in the admin's order. */
export function sizesForColour(
  product: { variants?: VariantLike[] | null },
  color: string | null,
): string[] {
  return [...new Set(pickableVariants(product, color).map((v) => v.size))];
}

/**
 * The photographs to show, and their descriptions.
 *
 * A colourway with its own shoot replaces the product's images entirely rather
 * than appending — showing the Black jacket underneath the Bone one is worse
 * than showing nothing. Alt text is per-product and index-aligned; a colourway
 * shot falls back to a generated description, which still beats an empty alt.
 */
export function galleryFor(
  product: {
    name: string;
    images: string[];
    imageAlts?: string[] | null;
    variants?: VariantLike[] | null;
  },
  color: string | null,
): { src: string; alt: string }[] {
  const own = pickableVariants(product, color).find(
    (v) => (v.images?.length ?? 0) > 0,
  );
  if (own?.images?.length) {
    return own.images.map((src, i) => ({
      src,
      alt: `${product.name} in ${color} — view ${i + 1}`,
    }));
  }
  return product.images.map((src, i) => ({
    src,
    alt: product.imageAlts?.[i]?.trim() || `${product.name} — view ${i + 1}`,
  }));
}

/** How a line reads on a receipt or a cart row: "Bone · M". */
export function variantLabel(
  color: string | null | undefined,
  size: string | null | undefined,
): string {
  return [color, size].filter(Boolean).join(" · ");
}
