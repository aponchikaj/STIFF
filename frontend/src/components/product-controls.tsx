"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cartApi } from "@/lib/api";
import {
  colourways,
  findVariant,
  hasColourways,
  priceForSize,
  sizesForColour,
  stockForSize,
} from "@/lib/checkout";
import { useContent } from "@/lib/content";
import { formatPrice } from "@/lib/format";
import type { ProductDetail } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { MinusIcon, PlusIcon } from "./icons";
import { Magnetic } from "./motion";
import { useSession } from "./providers";
import { btnOutline, btnSolid, labelCls } from "./ui";

export function ProductControls({
  product,
  colour,
  onColourChange,
}: {
  product: ProductDetail;
  /** Lifted so the gallery can swap to the colourway's own photographs. */
  colour: string;
  onColourChange: (colour: string) => void;
}) {
  const router = useRouter();
  const { refreshBadges } = useSession();
  const colours = useMemo(() => colourways(product), [product]);
  const multiColour = hasColourways(product);
  const sizes = useMemo(
    () => sizesForColour(product, colour).filter((s) => s !== ""),
    [product, colour],
  );

  const [size, setSize] = useState<string | null>(
    sizes.length === 1 ? sizes[0] : null,
  );
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<React.ReactNode>(null);
  const [mounted, setMounted] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  // Threshold and wording are admin-editable (Content -> Storefront thresholds),
  // so urgency copy can be tuned without a deploy.
  const storefront = useContent("storefront");
  const lowStockThreshold = Number(storefront.text("lowStockThreshold", "3"));
  const lowStockLabel = storefront.text("lowStockLabel", "Only {n} left");

  const soldOut =
    sizes.length === 0
      ? stockForSize(product, "", colour) === 0
      : sizes.every((s) => stockForSize(product, s, colour) === 0);
  const available = stockForSize(product, size, colour);
  const unitPrice = priceForSize(product, size, colour);
  const selectedVariant = findVariant(product, size ?? "", colour);


  /** Only worth saying when the number is small enough to actually pressure. */
  function lowStock(qty: number): boolean {
    return lowStockThreshold > 0 && qty > 0 && qty <= lowStockThreshold;
  }
  const sizeSoldOut = sizes.length > 0 && !!size && available === 0;
  const maxQty = Math.min(Math.max(available, 1), 9);

  useEffect(() => {
    setMounted(true);
  }, []);

  // A colour change can invalidate the chosen size — the Bone run may stop at
  // L. Keep it when the new colour also has it, drop it when it does not,
  // rather than leaving a selection that cannot be bought.
  useEffect(() => {
    setSize((current) => {
      if (current && sizes.includes(current)) return current;
      return sizes.length === 1 ? sizes[0] : null;
    });
    setQuantity(1);
  }, [sizes]);

  // Sticky buy bar appears once the main CTA scrolls out of view.
  useEffect(() => {
    const target = ctaRef.current;
    if (!target || soldOut) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [soldOut]);

  async function addToCart(goToCart: boolean) {
    // No login wall. Guests get a cart keyed to the `stiff_cart` cookie, and
    // signing in later folds it into the account.
    if (sizes.length > 0 && !size) {
      setMessage("Pick a size first.");
      return;
    }
    if (!selectedVariant) {
      setMessage("That combination isn't available.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      // The variant id, not the labels: it names the exact colour and size, so
      // two colourways sharing a size label cannot be confused for each other.
      await cartApi.addToCart(product.id, quantity, {
        variantId: selectedVariant.id,
        size: size ?? undefined,
        color: colour || undefined,
      });
      await refreshBadges();
      if (goToCart) {
        router.push("/cart");
        return;
      }
      setMessage(
        <>
          Added to cart.{" "}
          <Link
            href="/cart"
            className="rounded-[2px] font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            View cart
          </Link>
        </>,
      );
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      {multiColour && (
        <>
          <p className={labelCls}>
            Colour{colour ? <span className="text-muted"> — {colour}</span> : null}
          </p>
          <div
            role="radiogroup"
            aria-label="Colour"
            className="mt-3 flex flex-wrap gap-2"
          >
            {colours.map((way) => {
              const out = way.stock === 0 || !way.isActive;
              const selected = way.color === colour;
              return (
                <button
                  key={way.color}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={out ? `${way.color} — sold out` : way.color}
                  disabled={!way.isActive}
                  onClick={() => onColourChange(way.color)}
                  title={way.color}
                  className={`flex h-11 items-center gap-2 rounded-[2px] border px-3 text-xs font-medium uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected
                      ? "border-foreground text-foreground"
                      : "border-subtle text-muted hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {way.colorHex && (
                    <span
                      aria-hidden
                      style={{ backgroundColor: way.colorHex }}
                      className={`size-5 shrink-0 rounded-full border border-subtle ${
                        out ? "opacity-40" : ""
                      }`}
                    />
                  )}
                  <span className={out ? "line-through" : undefined}>
                    {way.color}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {sizes.length > 0 && (
        <>
          <p className={`${labelCls} ${multiColour ? "mt-6" : ""}`}>Size</p>
          <div
            role="radiogroup"
            aria-label="Size"
            className="mt-3 flex flex-wrap gap-2"
          >
            {sizes.map((s) => {
              const qty = stockForSize(product, s, colour);
              const out = qty === 0;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={size === s}
                  disabled={out}
                  onClick={() => {
                    setSize(s);
                    setQuantity((q) => Math.min(q, Math.min(Math.max(qty, 1), 9)));
                  }}
                  className={`flex h-11 min-w-11 items-center justify-center rounded-[2px] border px-4 text-xs font-medium uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:cursor-not-allowed disabled:opacity-40 ${
                    size === s
                      ? "border-foreground bg-foreground text-background"
                      : "border-subtle text-muted hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {size && lowStock(available) && (
            <p
              aria-live="polite"
              className="mt-2 text-[11px] font-medium uppercase tracking-[0.15em]"
            >
              {lowStockLabel.replace("{n}", String(available))} in {size}
            </p>
          )}
        </>
      )}



      {!soldOut && (
        <div className="mt-6">
          <p className={labelCls}>Quantity</p>
          <div className="mt-3 flex items-center gap-1">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex size-11 items-center justify-center rounded-[2px] border border-subtle text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:opacity-40"
            >
              <MinusIcon className="size-4" />
            </button>
            <span className="flex h-11 min-w-11 items-center justify-center text-sm font-bold">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= maxQty}
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              className="flex size-11 items-center justify-center rounded-[2px] border border-subtle text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:opacity-40"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        </div>
      )}

      <div ref={ctaRef} className="mt-8 flex flex-wrap items-center gap-3">
        <Magnetic className="inline-block">
          <button
            type="button"
            disabled={busy || soldOut || sizeSoldOut}
            onClick={() => addToCart(false)}
            className={btnSolid}
          >
            {soldOut || sizeSoldOut
              ? "Sold out"
              : busy
                ? "Adding…"
                : "Add to cart"}
          </button>
        </Magnetic>
        {!soldOut && !sizeSoldOut && (
          <button
            type="button"
            disabled={busy}
            onClick={() => addToCart(true)}
            className={`${btnOutline} h-12 px-6`}
          >
            Buy now
          </button>
        )}
      </div>
      <p aria-live="polite" className="mt-4 min-h-5 text-xs text-muted">
        {message}
        {!message && available > 0 && available <= 5 && (
          <>Only {available} left in stock.</>
        )}
      </p>

      {/* Portaled sticky buy bar — instant conversion once the CTA is gone */}
      {mounted &&
        showStickyBar &&
        !soldOut &&
        createPortal(
          <div className="fixed inset-x-0 bottom-0 z-[55] border-t border-foreground bg-background">
            <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold uppercase tracking-wide">
                  {product.name}
                </p>
                <p className="text-xs text-muted">
                  {formatPrice(unitPrice)}
                  {[colour, size].filter(Boolean).length > 0
                    ? ` · ${[colour, size].filter(Boolean).join(" · ")}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => addToCart(false)}
                className="flex h-11 shrink-0 items-center rounded-[2px] bg-foreground px-6 text-xs font-bold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:opacity-40"
              >
                {busy ? "Adding…" : "Add to cart"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
