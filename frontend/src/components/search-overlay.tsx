"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { searchApi } from "@/lib/api";
import type { SearchResults } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import { XIcon } from "./icons";
import { ProductImage } from "./product-image";
import { labelCls, Spinner } from "./ui";

export function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus, Esc-to-close and scroll lock while open.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

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

  if (!open) return null;

  const empty =
    results && results.products.length === 0 && results.gallery.length === 0;

  // Portaled to <body>: the navbar's backdrop-blur would otherwise make the
  // header the containing block for this fixed overlay.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-[60] flex flex-col bg-background"
    >
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-foreground px-4 sm:px-6">
        <input
          ref={inputRef}
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="SEARCH PIECES, SHOOTS…"
          aria-label="Search the site"
          className="h-full flex-1 bg-transparent text-base font-medium uppercase tracking-[0.08em] text-foreground placeholder:text-muted/50 focus:outline-none sm:text-xl"
        />
        {loading && <Spinner className="size-4" />}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="flex size-10 items-center justify-center rounded-[2px] text-foreground transition-colors hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
        >
          <XIcon className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        {term.trim().length < 2 && (
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Type at least two characters
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-muted">
            {error}
          </p>
        )}
        {empty && (
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Nothing found for “{results?.query}”
          </p>
        )}

        {results && results.products.length > 0 && (
          <section aria-label="Product results">
            <p className={labelCls}>Clothing — {results.products.length}</p>
            <ul className="mt-4 border-t border-subtle">
              {results.products.map((product) => (
                <li key={product.id} className="border-b border-subtle">
                  <Link
                    href={`/clothing/${product.slug}`}
                    onClick={onClose}
                    className="flex items-center gap-4 py-3 transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none"
                  >
                    <div className="w-12 shrink-0">
                      <ProductImage
                        src={product.images[0]}
                        alt=""
                        aspect="aspect-square"
                        iconClassName="size-4 text-subtle"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold uppercase tracking-wide">
                        {product.name}
                      </p>
                      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                        {product.category ?? "Stiff"}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-bold">
                      {formatPrice(product.priceCents)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {results && results.gallery.length > 0 && (
          <section aria-label="Gallery results" className="mt-10">
            <p className={labelCls}>Gallery — {results.gallery.length}</p>
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {results.gallery.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/gallery/${item.id}`}
                    onClick={onClose}
                    className="group block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                  >
                    <ProductImage
                      src={item.imageUrl}
                      alt={item.title}
                      aspect="aspect-square"
                      className="transition-opacity group-hover:opacity-90"
                    />
                    <p className="mt-1 truncate text-[9px] font-medium uppercase tracking-[0.15em] text-muted">
                      {item.title}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}
