"use client";

import { productsApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { ProductCard } from "./product-card";
import { Loading } from "./ui";

export function FeaturedProducts({ count = 8 }: { count?: number }) {
  const { data, loading } = useAsync(
    () => productsApi.listProducts({ sort: "popular", pageSize: count }),
    [count],
  );

  if (loading) return <Loading label="Loading drops" />;
  if (!data || data.items.length === 0) {
    return (
      <p className="py-12 text-sm text-muted">
        The first drop lands soon. Check back.
      </p>
    );
  }

  return (
    <ul className="mt-10 grid grid-cols-2 gap-x-0.5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {data.items.map((product) => (
        <li key={product.id} className="cv-auto">
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
