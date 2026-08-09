import Link from "next/link";
import type { Product } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "./product-image";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/clothing/${product.slug}`}
      className="group block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
    >
      <div className="relative overflow-hidden transition-opacity group-hover:opacity-90">
        <ProductImage
          src={product.images[0]}
          alt={product.name}
          iconClassName="size-10 text-subtle transition-transform duration-500 group-hover:rotate-[360deg] sm:size-12"
        />
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
  );
}
