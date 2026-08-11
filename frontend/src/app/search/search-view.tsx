"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { searchApi } from "@/lib/api";
import type { SearchResults } from "@/lib/api";
import { galleryPath } from "@/lib/gallery-url";
import { errorMessage } from "@/lib/hooks";
import { Reveal } from "@/components/motion";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { ErrorNote, inputCls, labelCls, Spinner } from "@/components/ui";

export function SearchView() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const t = setTimeout(() => {
      searchApi
        .search(query)
        .then((r) => {
          if (id === requestId.current) {
            setResults(r);
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (id === requestId.current) setError(errorMessage(err));
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [term]);

  const empty =
    results && results.products.length === 0 && results.gallery.length === 0;

  return (
    <div>
      <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">Search</h1>
      <div className="relative mt-8 max-w-xl">
        <input
          ref={inputRef}
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search pieces, shoots…"
          aria-label="Search the site"
          className={`${inputCls} h-14 pr-12 text-base`}
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">
            <Spinner className="size-4" />
          </span>
        )}
      </div>

      {error && <ErrorNote message={error} />}
      {term.trim().length < 2 && (
        <p className="mt-6 text-sm text-muted">
          Type at least two characters.
        </p>
      )}
      {empty && (
        <p className="mt-6 text-sm text-muted">
          Nothing found for “{results?.query}”.
        </p>
      )}

      {results && results.products.length > 0 && (
        <section className="mt-12" aria-label="Product results">
          <p className={labelCls}>
            Clothing — {results.products.length}
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-x-0.5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {results.products.map((product, i) => (
              <li key={product.id}>
                <Reveal delay={(i % 4) * 0.05}>
                  <ProductCard product={product} />
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && results.gallery.length > 0 && (
        <section className="mt-14" aria-label="Gallery results">
          <p className={labelCls}>
            Gallery — {results.gallery.length}
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-6">
            {results.gallery.map((item) => (
              <li key={item.id}>
                <Link
                  href={galleryPath(item)}
                  className="group block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                >
                  <ProductImage
                    src={item.imageUrl}
                    alt={item.altText ?? item.title}
                    aspect="aspect-square"
                    sizes="(min-width: 1280px) 16vw, (min-width: 640px) 25vw, 50vw"
                    className="transition-opacity group-hover:opacity-90"
                  />
                  <p className="mt-2 truncate text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                    {item.title}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
