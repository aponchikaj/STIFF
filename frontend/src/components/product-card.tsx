import Link from "next/link";
import type { Product } from "@/lib/products";
import { AsteriskMark } from "./asterisk-mark";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/clothing/${product.slug}`}
      className="group block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
    >
      <div className="flex aspect-[3/4] items-center justify-center bg-surface transition-opacity group-hover:opacity-90">
        <AsteriskMark className="size-10 text-subtle transition-transform duration-500 group-hover:rotate-[360deg] sm:size-12" />
      </div>
      {/* Details hidden until hover on pointer devices; always visible on touch */}
      <div className="mt-3 transition-all duration-300 sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-visible:translate-y-0 sm:group-focus-visible:opacity-100">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide sm:text-sm">
            {product.name}
          </h3>
          <p className="text-xs text-muted sm:text-sm">{product.price} ₾</p>
        </div>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
          {product.category}
        </p>
      </div>
    </Link>
  );
}
