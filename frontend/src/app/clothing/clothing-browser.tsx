"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { productsApi } from "@/lib/api";
import type { Product, ProductSort } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { ShopClosed } from "@/components/if-shop";
import { Reveal } from "@/components/motion";
import { ProductCard } from "@/components/product-card";
import { useSession } from "@/components/providers";
import {
  btnOutline,
  chipCls,
  ErrorNote,
  inputCls,
  selectCls,
} from "@/components/ui";

const CATEGORIES = ["All", "Tees", "Hoodies", "Pants", "Accessories"];
const PAGE_SIZE = 12;

const SORTS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Popular" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
];

export function ClothingBrowser({ category }: { category: string }) {
  const { shopEnabled } = useSession();
  const [sort, setSort] = useState<ProductSort>("newest");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Debounce the search box into `query`.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [category, sort, query]);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    productsApi
      .listProducts({
        category: category === "All" ? undefined : category,
        sort,
        search: query || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((result) => {
        if (id !== requestId.current) return;
        setTotal(result.total);
        setItems((prev) =>
          page === 1 ? result.items : [...prev, ...result.items],
        );
      })
      .catch((err: unknown) => {
        if (id === requestId.current) setError(errorMessage(err));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [category, sort, query, page]);

  if (!shopEnabled) return <ShopClosed />;

  return (
    <>
      <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
            Clothing
          </h1>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {total} {total === 1 ? "piece" : "pieces"}
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <Link
                href={c === "All" ? "/clothing" : `/clothing?c=${c}`}
                aria-current={category === c ? "page" : undefined}
                className={chipCls(category === c)}
              >
                {c}
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pieces"
          aria-label="Search products"
          className={`${inputCls} h-10 sm:max-w-xs`}
        />
        <label className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Sort
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ProductSort)}
            className={selectCls}
          >
            {SORTS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <ErrorNote message={error} />}
      {loading && items.length === 0 && (
        <ul
          aria-hidden="true"
          className="mt-10 grid grid-cols-2 gap-x-0.5 gap-y-8 sm:mt-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}>
              <div className="aspect-[3/4] animate-pulse bg-surface" />
              <div className="mt-3 h-3 w-2/3 animate-pulse bg-surface" />
              <div className="mt-1.5 h-2.5 w-1/3 animate-pulse bg-surface" />
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="py-16 text-sm text-muted">
          Nothing here yet — the next drop is on its way.
        </p>
      )}

      <ul className="mt-10 grid grid-cols-2 gap-x-0.5 gap-y-8 sm:mt-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {items.map((product, i) => (
          <li key={product.id}>
            <Reveal delay={(i % 4) * 0.06}>
              <ProductCard product={product} />
            </Reveal>
          </li>
        ))}
      </ul>

      {items.length < total && (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => setPage((p) => p + 1)}
            className={btnOutline}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
