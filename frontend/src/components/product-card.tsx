import Link from "next/link";
import type { Product } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { TILE_WIDTHS, imageSrcSet, imageUrl } from "@/lib/image";
import { ProductImage } from "./product-image";
import { productShareSubject } from "@/lib/share-subject";
import { ShareButton } from "./share-button";

/** Matches the densest grid the card appears in (up to 6 columns). */
const CARD_SIZES =
  "(min-width: 1280px) 17vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

export function ProductCard({
  product,
  sizes = CARD_SIZES,
  priority = false,
}: {
  product: Product;
  sizes?: string;
  priority?: boolean;
}) {
  const hoverImage = product.images[1];
  const shareSubject = productShareSubject(product);
  return (
    // The share button is a sibling of the link, not a child — a button inside
    // an anchor is invalid and swallows the click.
    <div className="group relative">
      <Link
        href={`/clothing/${product.slug}`}
        className="block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
      >
        <div className="relative overflow-hidden">
        <ProductImage
          src={product.images[0]}
          // The admin's own description when there is one; the name is a
          // fallback, not a description of the photograph.
          alt={product.imageAlts?.[0]?.trim() || product.name}
          sizes={sizes}
          priority={priority}
          iconClassName="size-10 text-subtle transition-transform duration-500 group-hover:rotate-[360deg] sm:size-12"
        />
        {/* Second angle crossfades in on hover */}
        {hoverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(hoverImage, 640)}
            srcSet={imageSrcSet(hoverImage, TILE_WIDTHS) || undefined}
            sizes={sizes}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="absolute inset-0 h-full w-full bg-surface object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
          {product.stock === 0 && (
            <span className="absolute left-2 top-2 rounded-[2px] bg-foreground px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-background">
              Sold out
            </span>
          )}
        </div>
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide sm:text-sm">
              {product.name}
            </h3>
            <p className="text-xs text-muted sm:text-sm">
              {formatPrice(product.priceCents)}
            </p>
          </div>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
            {product.category ?? "Stiff"}
          </p>
        </div>
      </Link>
      {/* Always reachable on touch, revealed on hover on pointer devices. */}
      <div className="absolute right-2 top-2 flex flex-col gap-2 opacity-0 focus-within:opacity-100 group-hover:opacity-100 max-[1024px]:opacity-100">
        {shareSubject && <ShareButton subject={shareSubject} variant="icon" />}
      </div>
    </div>
  );
}
