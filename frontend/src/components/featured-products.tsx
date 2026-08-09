"use client";

import { productsApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { Reveal } from "./motion";
import { ProductCard } from "./product-card";
import { Loading } from "./ui";

export function FeaturedProducts() {
  const { data, loading } = useAsync(
    () => productsApi.listProducts({ sort: "popular", pageSize: 4 }),
    [],
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
    <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
      {data.items.map((product, i) => (
        <li key={product.id}>
          <Reveal delay={i * 0.08}>
            <ProductCard product={product} />
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
