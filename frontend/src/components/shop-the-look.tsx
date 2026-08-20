"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ProductInShot } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/image";

/**
 * Pins on the photograph, one per piece worn in it.
 *
 * The archive is a lookbook that has never sold anything: someone sees a coat
 * in a shot, and the only route from there to buying it is guessing its name
 * in the shop. This is that route.
 *
 * Pins are the point, so they are not hidden behind a hover — on a phone there
 * is no hover, and a control nobody can find is the same as no control. They
 * can be dismissed, because sometimes the photograph is the point.
 */

/** Pins are placed by percentage, so they hold through every breakpoint. */
function pinStyle(product: ProductInShot): React.CSSProperties {
  return { left: `${product.hotspotX ?? 50}%`, top: `${product.hotspotY ?? 50}%` };
}

/**
 * Keeps the card on screen when its pin is near an edge.
 *
 * A card anchored to a pin at 96% would otherwise hang off the frame, and on
 * a phone that is most of the card.
 */
function cardPlacement(product: ProductInShot): string {
  const x = product.hotspotX ?? 50;
  const y = product.hotspotY ?? 50;
  const horizontal =
    x < 25 ? "left-0" : x > 75 ? "right-0" : "left-1/2 -translate-x-1/2";
  const vertical = y > 55 ? "bottom-full mb-3" : "top-full mt-3";
  return `${horizontal} ${vertical}`;
}

export function ShopTheLook({ products }: { products: ProductInShot[] }) {
  const pinned = products.filter(
    (product) => product.hotspotX !== null && product.hotspotY !== null,
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const layer = useRef<HTMLDivElement>(null);

  // Escape closes the open card. It does not close the whole layer: the pins
  // are part of the page, not a dialog over it.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!layer.current?.contains(e.target as Node)) setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openId]);

  if (pinned.length === 0) return null;

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0">
      <button
        type="button"
        onClick={() => {
          setHidden((was) => !was);
          setOpenId(null);
        }}
        className="pointer-events-auto absolute bottom-2 left-2 z-20 rounded-[2px] bg-background/90 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-foreground backdrop-blur-sm transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
      >
        {hidden ? `Show ${pinned.length} piece${pinned.length === 1 ? "" : "s"}` : "Hide tags"}
      </button>

      {!hidden &&
        pinned.map((product) => {
          const open = openId === product.id;
          return (
            <div
              key={product.id}
              style={pinStyle(product)}
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
            >
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${product.name} — ${formatPrice(product.priceCents)}`}
                onClick={() => setOpenId(open ? null : product.id)}
                className={`pointer-events-auto flex size-7 items-center justify-center rounded-full border-2 border-background bg-foreground/80 backdrop-blur-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background ${
                  open ? "scale-110" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-background"
                />
              </button>

              {open && (
                <div
                  className={`pointer-events-auto absolute z-30 w-52 border border-subtle bg-background p-3 shadow-lg ${cardPlacement(product)}`}
                >
                  <Link
                    href={`/clothing/${product.slug}`}
                    className="flex gap-3 rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                  >
                    {product.images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl(product.images[0], 160)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-14 shrink-0 bg-surface object-cover"
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-xs uppercase tracking-tight text-foreground">
                        {product.name}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted tabular-nums">
                        {formatPrice(product.priceCents)}
                      </span>
                      <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.15em] text-foreground underline-offset-4 group-hover:underline">
                        {product.stock === 0 ? "Sold out" : "View piece →"}
                      </span>
                    </span>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
