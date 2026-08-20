"use client";

import Link from "next/link";
import { customersApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import { ProductImage } from "./product-image";

/**
 * "Goes with" — from what people actually bought together.
 *
 * Renders nothing at all when there is no evidence yet, which is the honest
 * state for a young catalogue. A strip of arbitrary products would be worse
 * than no strip.
 */
export function CrossSellStrip({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useAsync(() => customersApi.getCrossSell(), []);
  const products = data?.products ?? [];
  if (products.length === 0) return null;

  return (
    <section aria-label="Goes with" className="mt-5 border-t border-subtle pt-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
        Goes with
      </p>
      <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {products.map((product) => (
          <li key={product.id} className="w-24 shrink-0">
            <Link
              href={`/clothing/${product.slug}`}
              onClick={onNavigate}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
            >
              <div className="aspect-[3/4] bg-surface">
                {product.images[0] && (
                  <ProductImage
                    src={product.images[0]}
                    alt={product.name}
                    width={96}
                    height={128}
                    className="size-full object-cover"
                  />
                )}
              </div>
              <p className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-wide">
                {product.name}
              </p>
              <p className="text-[10px] text-muted">
                {formatPrice(product.priceCents)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
