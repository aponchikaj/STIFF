"use client";

import Link from "next/link";
import { useState } from "react";
import { authApi, cartApi, ApiError } from "@/lib/api";
import type { Order, ShippingAddress } from "@/lib/api";
import { formatPrice, shortId } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { MinusIcon, PlusIcon, XIcon } from "@/components/icons";
import { ShopClosed } from "@/components/if-shop";
import { useSession } from "@/components/providers";
import { ProductImage } from "@/components/product-image";
import {
  btnGhostSm,
  btnOutline,
  btnSolid,
  ErrorNote,
  Field,
  inputCls,
  labelCls,
  Loading,
} from "@/components/ui";

export function CartView() {
  const { user, loading: sessionLoading, refreshBadges, shopEnabled } =
    useSession();
  const { data: cart, setData: setCart, loading, error, reload } = useAsync(
    () => cartApi.getCart(),
    [user?.id],
  );
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [showAddress, setShowAddress] = useState(false);

  if (!shopEnabled) return <ShopClosed />;
  if (sessionLoading) return <Loading label="Loading cart" />;
  if (!user) {
    return (
      <div className="flex flex-col items-start gap-6">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">Cart</h1>
        <p className="text-sm text-muted">Log in to see your cart.</p>
        <Link href="/login?next=/cart" className={btnSolid}>
          Log in
        </Link>
      </div>
    );
  }

  if (order) {
    return (
      <div className="flex flex-col items-start gap-6">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
          Order placed
        </h1>
        <p className="text-sm leading-7 text-muted">
          Order <span className="font-bold text-foreground">#{shortId(order.id)}</span>{" "}
          is confirmed — {formatPrice(order.totalCents)},{" "}
          {order.items.length} {order.items.length === 1 ? "item" : "items"}.
          You&apos;ll get a notification at every step.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/account" className={btnSolid}>
            View my orders
          </Link>
          <Link href="/clothing" className={`${btnOutline} h-12 px-6`}>
            Keep shopping
          </Link>
        </div>
      </div>
    );
  }

  async function updateQuantity(itemId: string, quantity: number) {
    setBusyItem(itemId);
    setNote(null);
    try {
      const updated = await cartApi.updateCartItem(itemId, quantity);
      setCart(updated);
      await refreshBadges();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusyItem(null);
    }
  }

  async function removeItem(itemId: string) {
    setBusyItem(itemId);
    setNote(null);
    try {
      const updated = await cartApi.removeCartItem(itemId);
      setCart(updated);
      await refreshBadges();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusyItem(null);
    }
  }

  async function checkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const address: ShippingAddress = {
      fullName: String(data.get("fullName") ?? "") || undefined,
      line1: String(data.get("line1") ?? "") || undefined,
      city: String(data.get("city") ?? "") || undefined,
      postalCode: String(data.get("postalCode") ?? "") || undefined,
      country: String(data.get("country") ?? "") || undefined,
      phone: String(data.get("phone") ?? "") || undefined,
    };
    setCheckingOut(true);
    setNote(null);
    setNeedsVerify(false);
    try {
      const placed = await cartApi.checkout(
        showAddress ? { shippingAddress: address } : undefined,
      );
      setOrder(placed);
      await refreshBadges();
    } catch (err) {
      if (err instanceof ApiError && err.messages.includes("EMAIL_NOT_VERIFIED")) {
        setNeedsVerify(true);
      } else {
        setNote(errorMessage(err));
        reload();
      }
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div>
      <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">Cart</h1>

      {loading && <Loading label="Loading cart" />}
      {error && <ErrorNote message={error} />}

      {cart && cart.items.length === 0 && (
        <div className="mt-10 flex flex-col items-start gap-6">
          <p className="text-sm text-muted">Your cart is empty.</p>
          <Link href="/clothing" className={btnSolid}>
            Browse clothing
          </Link>
        </div>
      )}

      {cart && cart.items.length > 0 && (
        <>
          <ul className="mt-10 border-t border-subtle">
            {cart.items.map((item) => (
              <li
                key={item.id}
                className="flex gap-4 border-b border-subtle py-5"
              >
                <Link
                  href={`/clothing/${item.product.slug}`}
                  className="w-20 shrink-0 rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted sm:w-24"
                >
                  <ProductImage
                    src={item.product.images[0]}
                    alt={item.product.name}
                    iconClassName="size-6 text-subtle"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold uppercase tracking-wide sm:text-sm">
                        {item.product.name}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                        {item.size || "One size"}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${item.product.name}`}
                      disabled={busyItem === item.id}
                      onClick={() => removeItem(item.id)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-[2px] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                    >
                      <XIcon className="size-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={busyItem === item.id || item.quantity <= 1}
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="flex size-9 items-center justify-center rounded-[2px] border border-subtle text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:opacity-40"
                      >
                        <MinusIcon className="size-3.5" />
                      </button>
                      <span className="flex h-9 min-w-9 items-center justify-center text-sm font-bold">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={busyItem === item.id}
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="flex size-9 items-center justify-center rounded-[2px] border border-subtle text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:opacity-40"
                      >
                        <PlusIcon className="size-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-bold">
                      {formatPrice(item.product.priceCents * item.quantity)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between">
            <p className={labelCls}>Subtotal</p>
            <p className="text-lg font-bold">{formatPrice(cart.subtotalCents)}</p>
          </div>

          {needsVerify && (
            <div className="mt-6 border border-subtle p-4">
              <p className="text-xs leading-6 text-muted">
                Verify your email before placing an order — check your inbox
                for the link.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await authApi.resendVerification();
                    setNote("Verification email sent again.");
                  } catch (err) {
                    setNote(errorMessage(err));
                  }
                }}
                className={`${btnGhostSm} mt-2`}
              >
                Resend verification email
              </button>
            </div>
          )}

          <form onSubmit={checkout} className="mt-8 flex flex-col gap-5">
            <button
              type="button"
              onClick={() => setShowAddress((s) => !s)}
              className={`${btnGhostSm} self-start`}
              aria-expanded={showAddress}
            >
              {showAddress ? "− Hide shipping address" : "+ Add shipping address"}
            </button>
            {showAddress && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="ship-name" label="Full name">
                  <input id="ship-name" name="fullName" autoComplete="name" className={inputCls} />
                </Field>
                <Field id="ship-phone" label="Phone">
                  <input id="ship-phone" name="phone" autoComplete="tel" className={inputCls} />
                </Field>
                <div className="sm:col-span-2">
                  <Field id="ship-line1" label="Address">
                    <input id="ship-line1" name="line1" autoComplete="address-line1" className={inputCls} />
                  </Field>
                </div>
                <Field id="ship-city" label="City">
                  <input id="ship-city" name="city" autoComplete="address-level2" className={inputCls} />
                </Field>
                <Field id="ship-postal" label="Postal code">
                  <input id="ship-postal" name="postalCode" autoComplete="postal-code" className={inputCls} />
                </Field>
                <Field id="ship-country" label="Country">
                  <input id="ship-country" name="country" autoComplete="country-name" className={inputCls} />
                </Field>
              </div>
            )}
            <button type="submit" disabled={checkingOut} className={btnSolid}>
              {checkingOut
                ? "Placing order…"
                : `Checkout — ${formatPrice(cart.subtotalCents)}`}
            </button>
            <p aria-live="polite" className="min-h-5 text-xs text-muted">
              {note}
            </p>
          </form>
        </>
      )}
    </div>
  );
}
