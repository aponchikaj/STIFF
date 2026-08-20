"use client";

import { useEffect, useState } from "react";
import { productsApi } from "@/lib/api";
import type { Product } from "@/lib/api";
import { recentlyViewed, rememberViewed } from "@/lib/recently-viewed";
import { ProductCard } from "./product-card";
import { Reveal } from "./motion";

/**
 * "Recently viewed" — the way back to the piece you were comparing against.
 *
 * The list lives in the browser, so this fetches the cards for it in one
 * request rather than storing anything server-side. Renders nothing until
 * there are at least two, because a strip showing the page you are already on
 * is just clutter.
 */
export function RecentlyViewedStrip({
  currentId,
  currentSlug,
}: {
  /** Recorded as viewed, and excluded from the strip. */
  currentId?: string;
  currentSlug?: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (currentId) rememberViewed(currentId);
  }, [currentId, currentSlug]);

  useEffect(() => {
    // Read after the record above, so the current piece is already excluded
    // rather than appearing in its own strip.
    const ids = recentlyViewed().filter((id) => id !== currentId);
    if (ids.length === 0) {
      setProducts([]);
      return;
    }

    let cancelled = false;
    void productsApi
      .listProducts({ ids, pageSize: ids.length })
      .then((page) => {
        if (cancelled) return;
        // Restore the browser's order: the API returns them by date, and the
        // point of this strip is recency.
        const byId = new Map(page.items.map((p) => [p.id, p]));
        setProducts(
          ids
            .map((id) => byId.get(id))
            .filter((p): p is Product => p !== undefined),
        );
      })
      .catch(() => {
        // A failed convenience strip renders nothing rather than an error.
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentId, currentSlug]);

  if (products.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
      <Reveal>
        <h2 className="text-2xl uppercase tracking-tight sm:text-4xl">
          Recently viewed
        </h2>
      </Reveal>
      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {products.map((product) => (
          <li key={product.id} className="cv-auto">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
