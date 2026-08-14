"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cartApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { ProductDetail } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { MinusIcon, PlusIcon } from "./icons";
import { Magnetic } from "./motion";
import { useSession } from "./providers";
import { btnOutline, btnSolid, labelCls } from "./ui";

export function ProductControls({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const { user, refreshBadges } = useSession();
  const [size, setSize] = useState<string | null>(
    product.sizes.length === 1 ? product.sizes[0] : null,
  );
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<React.ReactNode>(null);
  const [mounted, setMounted] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  const soldOut = product.stock === 0;
  const maxQty = Math.min(Math.max(product.stock, 1), 9);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/clothing/${product.slug}`)}`);
      return;
    }
    if (product.sizes.length > 0 && !size) {
      setMessage("Pick a size first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await cartApi.addToCart(product.id, quantity, size ?? undefined);
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
      {product.sizes.length > 0 && (
        <>
          <p className={labelCls}>Size</p>
          <div
            role="radiogroup"
            aria-label="Size"
            className="mt-3 flex flex-wrap gap-2"
          >
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={size === s}
                onClick={() => setSize(s)}
                className={`flex h-11 min-w-11 items-center justify-center rounded-[2px] border px-4 text-xs font-medium uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
                  size === s
                    ? "border-foreground bg-foreground text-background"
                    : "border-subtle text-muted hover:border-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
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
            disabled={busy || soldOut}
            onClick={() => addToCart(false)}
            className={btnSolid}
          >
            {soldOut ? "Sold out" : busy ? "Adding…" : "Add to cart"}
          </button>
        </Magnetic>
        {!soldOut && (
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
        {!message && product.stock > 0 && product.stock <= 5 && (
          <>Only {product.stock} left in stock.</>
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
                  {formatPrice(product.priceCents)}
                  {size ? ` · ${size}` : ""}
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
