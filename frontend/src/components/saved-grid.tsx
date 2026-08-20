"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { customersApi, productsApi } from "@/lib/api";
import type { Product } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { useWishlist } from "@/lib/wishlist";
import { ProductCard } from "./product-card";
import { useSession } from "./providers";
import { btnGhostSm, btnOutline, ErrorNote, Loading } from "./ui";

/**
 * Saved pieces, for signed-in people and signed-out ones alike.
 *
 * Signed in, the list comes from the account. Signed out, the ids live in the
 * browser and the cards are fetched for them in one request — the same list,
 * from a different place, so the page is worth visiting either way. Without
 * this the save button worked signed out but had nowhere to lead.
 */
export function SavedGrid() {
  const { user } = useSession();
  const { ids, ready, toggle } = useWishlist(!!user);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (ids.length === 0) {
      setProducts([]);
      return;
    }

    let cancelled = false;
    const load = user
      ? customersApi.listWishlist()
      : productsApi
          .listProducts({ ids, pageSize: ids.length })
          // The browser's order is the saved order, which the catalogue query
          // does not preserve.
          .then((page) => {
            const byId = new Map(page.items.map((p) => [p.id, p]));
            return ids
              .map((id) => byId.get(id))
              .filter((p): p is Product => p !== undefined);
          });

    void load
      .then((items) => {
        if (!cancelled) setProducts(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });

    return () => {
      cancelled = true;
    };
    // `ids` is the dependency that matters: unsaving something re-runs this.
  }, [ids, ready, user]);

  if (!ready || products === null) return <Loading label="Loading saved" />;
  if (error) return <ErrorNote message={error} />;

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-start gap-6 py-12">
        <p className="max-w-md text-sm leading-6 text-muted">
          Nothing saved yet. Hit the bookmark on any piece and it lands here —
          no account needed.
        </p>
        <Link href="/clothing" className={btnOutline}>
          Browse clothing
        </Link>
      </div>
    );
  }

  return (
    <>
      {!user && (
        <p className="mb-8 max-w-md border border-subtle p-3 text-xs leading-6 text-muted">
          These are saved in this browser.{" "}
          <Link
            href="/login?next=/saved"
            className="rounded-[2px] font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            Sign in
          </Link>{" "}
          to keep them, and they will move across with you.
        </p>
      )}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id} className="flex flex-col gap-2">
            <ProductCard product={product} />
            <button
              type="button"
              onClick={() => void toggle(product.id)}
              className={`${btnGhostSm} self-start`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
