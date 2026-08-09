"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { productsApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import { ProductImage } from "./product-image";
import { Loading } from "./ui";

const AUTO_ADVANCE_MS = 6000;

/** Auto-advancing product strip: 2 visible on phones, up to 6 on wide
 *  screens; slides one card every few seconds, pauses while interacting. */
export function ProductCarousel() {
  const { data, loading } = useAsync(
    () => productsApi.listProducts({ sort: "newest", pageSize: 12 }),
    [],
  );
  const trackRef = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();

  const items = data?.items ?? [];

  useEffect(() => {
    if (reduce || paused || items.length < 3) return;
    const id = setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const card = track.querySelector("li");
      if (!card) return;
      const step = card.getBoundingClientRect().width + 2;
      const atEnd =
        track.scrollLeft + track.clientWidth >= track.scrollWidth - step / 2;
      track.scrollTo({
        left: atEnd ? 0 : track.scrollLeft + step,
        behavior: "smooth",
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [reduce, paused, items.length]);

  if (loading) return <Loading label="Loading the drop" />;
  if (items.length === 0) {
    return (
      <p className="py-12 text-sm text-muted">
        The first drop lands soon. Check back.
      </p>
    );
  }

  return (
    <ul
      ref={trackRef}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      className="mt-8 flex snap-x snap-mandatory gap-0.5 overflow-x-auto scroll-smooth pb-2"
    >
      {items.map((product) => (
        <li
          key={product.id}
          className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[19%] xl:w-[16%]"
        >
          <Link
            href={`/clothing/${product.slug}`}
            className="group block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            <div className="relative overflow-hidden transition-opacity group-hover:opacity-90">
              <ProductImage
                src={product.images[0]}
                alt={product.name}
                iconClassName="size-8 text-subtle"
              />
              {product.stock === 0 && (
                <span className="absolute left-0 top-0 w-full bg-foreground py-1 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-background">
                  Sold out
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <p className="truncate text-[11px] font-bold uppercase tracking-wide">
                {product.name}
              </p>
              <p className="shrink-0 text-[11px] text-muted">
                {formatPrice(product.priceCents)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
