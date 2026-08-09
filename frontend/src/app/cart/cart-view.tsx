"use client";

import Link from "next/link";
import { useState } from "react";
import { authApi, cartApi, ApiError } from "@/lib/api";
import type { Order, ShippingAddress } from "@/lib/api";
import { formatPrice, shortId } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { MinusIcon, PlusIcon, XIcon } from "@/components/icons";
import { ShopClosed } from "@/components/if-shop";
import { Reveal } from "@/components/motion";
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

  if (!shopEnabled) return <ShopClosed />;
  if (sessionLoading) return <Loading label="Loading cart" />;
  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
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
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
          Order placed
        </h1>
        <p className="text-sm leading-7 text-muted">
          Order{" "}
          <span className="font-bold text-foreground">
            #{shortId(order.id)}
          </span>{" "}
          is confirmed — {formatPrice(order.totalCents)}, {order.items.length}{" "}
          {order.items.length === 1 ? "item" : "items"}. You&apos;ll get a
          notification at every step.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
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
      firstName: String(data.get("firstName") ?? ""),
      lastName: String(data.get("lastName") ?? ""),
      line1: String(data.get("line1") ?? ""),
      city: String(data.get("city") ?? ""),
      country: String(data.get("country") ?? ""),
      phone: String(data.get("phone") ?? ""),
    };
    setCheckingOut(true);
    setNote(null);
    setNeedsVerify(false);
    try {
      const placed = await cartApi.checkout({ shippingAddress: address });
      setOrder(placed);
      await refreshBadges();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.messages.includes("EMAIL_NOT_VERIFIED")
      ) {
        setNeedsVerify(true);
      } else {
        setNote(errorMessage(err));
        reload();
      }
    } finally {
      setCheckingOut(false);
    }
  }

  const itemCount =
    cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Reveal>
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">Cart</h1>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </p>
      </Reveal>

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
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
          {/* Items */}
          <Reveal>
            <ul className="border-t border-subtle">
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
                          {item.size || "One size"} ·{" "}
                          {formatPrice(item.product.priceCents)} each
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
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
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
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
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
          </Reveal>

          {/* Order summary */}
          <Reveal delay={0.1} className="lg:sticky lg:top-24 lg:self-start">
            <form
              onSubmit={checkout}
              className="flex flex-col gap-5 border border-foreground p-5 sm:p-6"
            >
              <p className={labelCls}>Order summary</p>
              <div className="flex flex-col gap-2 border-b border-subtle pb-4 text-sm">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span>{formatPrice(cart.subtotalCents)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatPrice(cart.subtotalCents)}</span>
                </div>
              </div>

              {needsVerify && (
                <div className="border border-subtle p-3">
                  <p className="text-xs leading-6 text-muted">
                    Verify your email before placing an order — check your
                    inbox for the link.
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

              <p className={labelCls}>Shipping details</p>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field id="ship-first" label="Name">
                    <input
                      id="ship-first"
                      name="firstName"
                      required
                      autoComplete="given-name"
                      className={inputCls}
                    />
                  </Field>
                  <Field id="ship-last" label="Last name">
                    <input
                      id="ship-last"
                      name="lastName"
                      required
                      autoComplete="family-name"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field id="ship-line1" label="Address">
                  <input
                    id="ship-line1"
                    name="line1"
                    required
                    autoComplete="street-address"
                    className={inputCls}
                  />
                </Field>
                <Field id="ship-phone" label="Phone">
                  <input
                    id="ship-phone"
                    name="phone"
                    type="tel"
                    required
                    minLength={3}
                    autoComplete="tel"
                    className={inputCls}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field id="ship-city" label="City">
                    <input
                      id="ship-city"
                      name="city"
                      required
                      autoComplete="address-level2"
                      className={inputCls}
                    />
                  </Field>
                  <Field id="ship-country" label="Country">
                    <input
                      id="ship-country"
                      name="country"
                      required
                      autoComplete="country-name"
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>

              <button
                type="submit"
                disabled={checkingOut}
                className={`${btnSolid} w-full`}
              >
                {checkingOut ? "Placing order…" : "Checkout"}
              </button>
              <p aria-live="polite" className="min-h-5 text-xs text-muted">
                {note}
              </p>
            </form>
          </Reveal>
        </div>
      )}
    </div>
  );
}
