"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cartApi } from "@/lib/api";
import type { CartView } from "@/lib/api";
import { useContent } from "@/lib/content";
import { formatPrice } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import { MinusIcon, PlusIcon, XIcon } from "./icons";
import { useSession } from "./providers";
import { ProductImage } from "./product-image";
import { btnSolid, labelCls, Loading } from "./ui";
import { variantLabel } from "@/lib/checkout";

const EASE = [0.16, 1, 0.3, 1] as const;

export function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, refreshBadges } = useSession();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
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
    if (!open || !user) return;
    setLoading(true);
    setNote(null);
    cartApi
      .getCart()
      .then(setCart)
      .catch((err: unknown) => setNote(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [open, user]);

  async function updateQuantity(itemId: string, quantity: number) {
    setBusyItem(itemId);
    try {
      setCart(await cartApi.updateCartItem(itemId, quantity));
      await refreshBadges();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusyItem(null);
    }
  }

  async function removeItem(itemId: string) {
    setBusyItem(itemId);
    try {
      setCart(await cartApi.removeCartItem(itemId));
      await refreshBadges();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusyItem(null);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close cart"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-foreground/40"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Cart"
            initial={reduce ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={reduce ? undefined : { x: "100%" }}
            transition={{ duration: 0.35, ease: EASE }}
            className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md flex-col border-l border-foreground bg-background"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-subtle px-4 sm:px-5">
              <p className="text-sm font-bold uppercase tracking-[0.2em]">
                Cart
              </p>
              <button
                type="button"
                aria-label="Close cart"
                onClick={onClose}
                className="flex size-10 items-center justify-center rounded-[2px] text-foreground transition-colors hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {!user && (
                <div className="flex flex-col items-start gap-4 py-8">
                  <p className="text-sm text-muted">
                    Log in to see your cart.
                  </p>
                  <Link
                    href="/login?next=/cart"
                    onClick={onClose}
                    className={btnSolid}
                  >
                    Log in
                  </Link>
                </div>
              )}
              {user && loading && <Loading label="Loading cart" />}
              {note && (
                <p role="alert" className="py-2 text-xs text-muted">
                  {note}
                </p>
              )}
              {user && cart && cart.items.length === 0 && !loading && (
                <div className="flex flex-col items-start gap-4 py-8">
                  <p className="text-sm text-muted">Your cart is empty.</p>
                  <Link
                    href="/clothing"
                    onClick={onClose}
                    className={btnSolid}
                  >
                    Browse clothing
                  </Link>
                </div>
              )}
              {user && cart && cart.items.length > 0 && (
                <ul>
                  {cart.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex gap-3 border-b border-subtle py-4"
                    >
                      <Link
                        href={`/clothing/${item.product.slug}`}
                        onClick={onClose}
                        className="w-16 shrink-0 rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                      >
                        <ProductImage
                          src={item.product.images[0]}
                          alt={item.product.name}
                          sizes="64px"
                          iconClassName="size-5 text-subtle"
                        />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[11px] font-bold uppercase tracking-wide">
                            {item.product.name}
                          </p>
                          <button
                            type="button"
                            aria-label={`Remove ${item.product.name}`}
                            disabled={busyItem === item.id}
                            onClick={() => removeItem(item.id)}
                            className="flex size-7 shrink-0 items-center justify-center rounded-[2px] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                          {variantLabel(item.variant?.color, item.size) || "One size"}
                        </p>
                        <div className="mt-auto flex items-center justify-between gap-2">
                          <div className="flex items-center">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              disabled={
                                busyItem === item.id || item.quantity <= 1
                              }
                              onClick={() =>
                                updateQuantity(item.id, item.quantity - 1)
                              }
                              className="flex size-8 items-center justify-center rounded-[2px] border border-subtle text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:opacity-40"
                            >
                              <MinusIcon className="size-3" />
                            </button>
                            <span className="flex h-8 min-w-8 items-center justify-center text-xs font-bold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              disabled={busyItem === item.id}
                              onClick={() =>
                                updateQuantity(item.id, item.quantity + 1)
                              }
                              className="flex size-8 items-center justify-center rounded-[2px] border border-subtle text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:opacity-40"
                            >
                              <PlusIcon className="size-3" />
                            </button>
                          </div>
                          <p className="text-xs font-bold">
                            {formatPrice(
                              item.product.priceCents * item.quantity,
                            )}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {user && cart && cart.items.length > 0 && (
              <div className="shrink-0 border-t border-foreground px-4 py-4 sm:px-5">
                <div className="flex items-center justify-between">
                  <p className={labelCls}>Subtotal</p>
                  <p className="text-base font-bold">
                    {formatPrice(cart.subtotalCents)}
                  </p>
                </div>
                <FreeShippingMeter subtotalCents={cart.subtotalCents} />
                <Link
                  href="/cart"
                  onClick={onClose}
                  className={`${btnSolid} mt-4 w-full active:scale-[0.98]`}
                >
                  Checkout — {formatPrice(cart.subtotalCents)}
                </Link>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Progress toward free delivery.
 *
 * Replaces a hardcoded "Free shipping — on every order" line that was simply
 * untrue: checkout charges 5 GEL in Tbilisi and 10 to the regions. The
 * threshold is admin-editable under Content, and 0 means the shop is not
 * running the offer — in which case this says nothing rather than inventing a
 * promise.
 */
function FreeShippingMeter({ subtotalCents }: { subtotalCents: number }) {
  const storefront = useContent("storefront");
  const threshold = Number(
    storefront.text("freeShippingThresholdCents", "0"),
  );

  if (!Number.isFinite(threshold) || threshold <= 0) return null;

  const reached = subtotalCents >= threshold;
  const pct = Math.min(100, Math.round((subtotalCents / threshold) * 100));

  return (
    <div className="mt-3">
      <div className="h-1 w-full bg-subtle">
        <div
          className="h-1 bg-foreground transition-[width] duration-300"
          style={{ width: `${reached ? 100 : pct}%` }}
        />
      </div>
      <p
        aria-live="polite"
        className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted"
      >
        {reached
          ? "Free delivery unlocked"
          : `${formatPrice(threshold - subtotalCents)} away from free delivery`}
      </p>
    </div>
  );
}
