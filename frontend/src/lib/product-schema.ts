import type { Product } from "@/lib/api";
import { colourOf, pickableVariants } from "@/lib/checkout";
import { imageUrl } from "@/lib/image";
import { SITE_URL } from "@/lib/site";

/**
 * Product structured data, for the rich result.
 *
 * Price and availability shown directly in a search listing is free traffic,
 * and the only part of it Google trusts is the part that matches the page.
 * So every field here is read from the same data the page renders — nothing
 * is asserted that a shopper could arrive and find untrue. In particular
 * there is no `aggregateRating`: the shop does not collect star ratings, and
 * inventing a score to win a row of stars is exactly the kind of thing that
 * gets structured data ignored.
 */

/** Shipped as new. There is no second-hand line. */
const CONDITION = "https://schema.org/NewCondition";

/** Matches `DEFAULT_RETURN_WINDOW_DAYS` in backend/src/returns/return-rules.ts */
const RETURN_WINDOW_DAYS = 14;

/** Matches SHIPPING_FEES_CENTS.tbilisi in backend/src/orders/checkout.constants.ts */
const TBILISI_SHIPPING_GEL = "5.00";

function availabilityOf(stock: number): string {
  return stock > 0
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
}

function gel(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * A year out.
 *
 * Google wants a date on an offer and drops the price from the result once it
 * passes. These are not timed prices, so the horizon is arbitrary — but it has
 * to be a real date, and it has to be in the future.
 */
function priceValidUntil(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export function productJsonLd(product: Product): Record<string, unknown> {
  const url = `${SITE_URL}/clothing/${product.slug}`;
  const variants = pickableVariants(product);

  // One offer per buyable colour and size, because that is what has a SKU, a
  // price and a stock level. A single offer for the product would have to
  // pick one of them and be wrong about the rest.
  const offers = variants.map((variant) => {
    const label = [colourOf(variant), variant.size].filter(Boolean).join(" ");
    return {
      "@type": "Offer",
      name: label || product.name,
      sku: variant.sku ?? undefined,
      priceCurrency: "GEL",
      price: gel(product.priceCents + (variant.priceDeltaCents ?? 0)),
      priceValidUntil: priceValidUntil(),
      itemCondition: CONDITION,
      availability: availabilityOf(variant.stock),
      url,
      seller: { "@type": "Organization", name: "STIFF" },
    };
  });

  const prices = offers.map((offer) => Number(offer.price));
  const lowPrice = prices.length > 0 ? Math.min(...prices) : product.priceCents / 100;
  const highPrice = prices.length > 0 ? Math.max(...prices) : product.priceCents / 100;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image:
      product.images.length > 0
        ? product.images.map((src) => imageUrl(src, 1200, "detail"))
        : undefined,
    url,
    sku: variants.find((v) => v.sku)?.sku ?? undefined,
    category: product.category ?? undefined,
    brand: { "@type": "Brand", name: "STIFF" },
    // The colours actually sold, as a variant attribute rather than prose.
    color:
      [...new Set(variants.map(colourOf).filter(Boolean))].join(", ") ||
      undefined,
    size: product.sizes.length > 0 ? product.sizes : undefined,
    offers:
      offers.length > 1
        ? {
            "@type": "AggregateOffer",
            offerCount: offers.length,
            priceCurrency: "GEL",
            lowPrice: lowPrice.toFixed(2),
            highPrice: highPrice.toFixed(2),
            availability: availabilityOf(product.stock),
            offers,
          }
        : (offers[0] ?? {
            "@type": "Offer",
            priceCurrency: "GEL",
            price: gel(product.priceCents),
            priceValidUntil: priceValidUntil(),
            itemCondition: CONDITION,
            availability: availabilityOf(product.stock),
            url,
          }),
    // Both of these are what /rules already promises in prose. Repeating them
    // as data is what puts "free returns" in the listing.
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "GE",
      returnPolicyCategory:
        "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: RETURN_WINDOW_DAYS,
      returnMethod: "https://schema.org/ReturnByMail",
      returnFees: "https://schema.org/ReturnShippingFees",
    },
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: {
        "@type": "MonetaryAmount",
        value: TBILISI_SHIPPING_GEL,
        currency: "GEL",
      },
      shippingDestination: {
        "@type": "DefinedRegion",
        addressCountry: "GE",
      },
    },
  };
}
