"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  authApi,
  cartApi,
  customersApi,
  paymentsApi,
  promotionsApi,
  ApiError,
} from "@/lib/api";
import type {
  PaymentAvailability,
  PriceBreakdown,
  ShippingAddress,
} from "@/lib/api";
import {
  SHIPPING_FEES_CENTS,
  SHIPPING_LABELS,
  SHIPPING_METHODS,
  stockForSize,
  type PaymentMethod,
  type ShippingMethod,
} from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { MinusIcon, PlusIcon, XIcon } from "@/components/icons";
import { ShopClosed } from "@/components/if-shop";
import { Reveal } from "@/components/motion";
import { useSession } from "@/components/providers";
import { ProductImage } from "@/components/product-image";
import {
  btnGhostSm,
  chipCls,
  btnSolid,
  ErrorNote,
  Field,
  inputCls,
  labelCls,
  Loading,
  selectCls,
} from "@/components/ui";

export function CartView() {
  const router = useRouter();
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
  const [shippingMethod, setShippingMethodState] =
    useState<ShippingMethod>("tbilisi");

  /** Changing delivery can cross the free-shipping line, so the quote goes. */
  function setShippingMethod(next: ShippingMethod) {
    setShippingMethodState(next);
    setQuote(null);
    setCodeNote(null);
  }
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [discountCode, setDiscountCode] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<string | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<string | null>(null);
  const [quote, setQuote] = useState<PriceBreakdown | null>(null);
  const [codeNote, setCodeNote] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [addressId, setAddressId] = useState<string | null>(null);

  // Signed-in buyers retyped their address every order. The default is
  // preselected because it is the one they almost always want.
  const { data: addresses } = useAsync(
    () => (user ? customersApi.listAddresses() : Promise.resolve([])),
    [user?.id],
  );
  const { data: regionData } = useAsync(() => customersApi.getRegions(), []);
  const regions = regionData?.regions ?? ["Tbilisi"];
  const savedAddress =
    addressId === ""
      ? null
      : ((addresses ?? []).find((a) => a.id === addressId) ??
        (addresses ?? []).find((a) => a.isDefault) ??
        null);

  // Which methods exist and which are usable is the server's call — see
  // `payments/payment.types.ts`. Hardcoding it here is what previously let the
  // page offer a card option nothing could take.
  const { data: paymentData } = useAsync(
    () => paymentsApi.getPaymentMethods(),
    [],
  );
  const paymentOptions: PaymentAvailability[] = paymentData?.methods ?? [];
  const selectedPayment =
    paymentOptions.find((option) => option.method === paymentMethod) ?? null;

  if (!shopEnabled) return <ShopClosed />;
  if (sessionLoading) return <Loading label="Loading cart" />;

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

  /**
   * Asks the server what the order costs with these codes.
   *
   * Nothing is computed here — checkout re-resolves the same codes, so a
   * preview that disagreed with the charge would be the bug this avoids.
   */
  async function applyCodes() {
    setApplying(true);
    setCodeNote(null);
    try {
      const result = await promotionsApi.quote({
        shippingMethod,
        discountCode: discountCode.trim() || undefined,
        giftCardCode: giftCardCode.trim() || undefined,
      });
      setQuote(result);
      setAppliedDiscount(
        result.discountCents > 0 || !discountCode.trim()
          ? discountCode.trim().toUpperCase() || null
          : null,
      );
      setAppliedGiftCard(
        result.giftCardCents > 0 ? giftCardCode.trim().toUpperCase() : null,
      );
      setCodeNote(
        result.discountCents > 0 || result.giftCardCents > 0
          ? "Applied."
          : "Nothing came off — check the code and the minimum.",
      );
    } catch (err) {
      // Keep the un-discounted quote so the page still shows a real total.
      setQuote(null);
      setAppliedDiscount(null);
      setAppliedGiftCard(null);
      setCodeNote(errorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  async function checkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const isPickup = shippingMethod === "pickup";
    const address: ShippingAddress = {
      firstName: String(data.get("firstName") ?? ""),
      lastName: String(data.get("lastName") ?? ""),
      line1: isPickup ? undefined : String(data.get("line1") ?? ""),
      city: isPickup ? undefined : String(data.get("city") ?? ""),
      // The shop ships inside Georgia only, so country is not asked for.
      country: isPickup ? undefined : "Georgia",
      phone: String(data.get("phone") ?? ""),
      region: isPickup ? undefined : String(data.get("region") ?? ""),
    };
    setCheckingOut(true);
    setNote(null);
    setNeedsVerify(false);
    try {
      const placed = await cartApi.checkout({
        shippingAddress: address,
        shippingMethod,
        paymentMethod,
        // Ignored for signed-in buyers; the only way to reach a guest.
        email: user ? undefined : String(data.get("email") ?? ""),
        discountCode: discountCode.trim() || undefined,
        giftCardCode: giftCardCode.trim() || undefined,
      });
      if (placed.payment.kind === "redirect") {
        window.location.href = placed.payment.url;
        return;
      }
      await refreshBadges();
      // The receipt page is the order's permanent home — it survives a
      // refresh, works for guests, and is what the confirmation email links
      // to. Keeping a second copy of it inline here only invited them to drift.
      router.push(`/orders/${placed.order.id}`);
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
  // The server prices the order; this page never does its own arithmetic on
  // discounts or shipping, so what is shown is what will be charged.
  const quoteBase: PriceBreakdown = {
    subtotalCents: cart?.subtotalCents ?? 0,
    discountCents: 0,
    shippingCents: SHIPPING_FEES_CENTS[shippingMethod],
    giftCardCents: 0,
    totalCents: (cart?.subtotalCents ?? 0) + SHIPPING_FEES_CENTS[shippingMethod],
  };
  const totals = quote ?? quoteBase;
  const pickup = shippingMethod === "pickup";

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
          <Reveal>
            <ul className="border-t border-subtle">
              {cart.items.map((item) => {
                const available = stockForSize(item.product, item.size);
                return (
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
                        sizes="(min-width: 640px) 96px, 80px"
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
                            disabled={
                              busyItem === item.id || item.quantity >= available
                            }
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
                );
              })}
            </ul>
          </Reveal>

          <Reveal delay={0.1} className="lg:sticky lg:top-24 lg:self-start">
            <form
              onSubmit={checkout}
              className="flex flex-col gap-5 border border-foreground p-5 sm:p-6"
            >
              <p className={labelCls}>Order summary</p>
              <div className="flex flex-col gap-2 border-b border-subtle pb-4 text-sm">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span>{formatPrice(totals.subtotalCents)}</span>
                </div>
                {totals.discountCents > 0 && (
                  <div className="flex justify-between text-muted">
                    <span>Discount{appliedDiscount ? ` (${appliedDiscount})` : ""}</span>
                    <span>−{formatPrice(totals.discountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted">
                  <span>{SHIPPING_LABELS[shippingMethod]}</span>
                  <span>
                    {totals.shippingCents === 0
                      ? "Free"
                      : formatPrice(totals.shippingCents)}
                  </span>
                </div>
                {totals.giftCardCents > 0 && (
                  <div className="flex justify-between text-muted">
                    <span>Gift card{appliedGiftCard ? ` (${appliedGiftCard})` : ""}</span>
                    <span>−{formatPrice(totals.giftCardCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatPrice(totals.totalCents)}</span>
                </div>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className={labelCls}>Discount or gift card</legend>
                <div className="flex gap-2">
                  <input
                    aria-label="Discount code"
                    value={discountCode}
                    placeholder="Discount code"
                    onChange={(e) => setDiscountCode(e.target.value)}
                    className={`${inputCls} h-10`}
                  />
                  <input
                    aria-label="Gift card code"
                    value={giftCardCode}
                    placeholder="Gift card"
                    onChange={(e) => setGiftCardCode(e.target.value)}
                    className={`${inputCls} h-10`}
                  />
                </div>
                <button
                  type="button"
                  disabled={applying}
                  onClick={applyCodes}
                  className={`${btnGhostSm} self-start`}
                >
                  {applying ? "Checking…" : "Apply"}
                </button>
                {codeNote && (
                  <p aria-live="polite" className="text-xs text-muted">
                    {codeNote}
                  </p>
                )}
              </fieldset>

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

              <fieldset>
                <legend className={labelCls}>Shipping</legend>
                <div className="mt-3 flex flex-col gap-2">
                  {SHIPPING_METHODS.map((method) => {
                    const fee = SHIPPING_FEES_CENTS[method];
                    const selected = shippingMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setShippingMethod(method)}
                        className={`flex h-11 items-center justify-between rounded-[2px] border px-3 text-left text-xs font-medium uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
                          selected
                            ? "border-foreground bg-foreground text-background"
                            : "border-subtle text-muted hover:border-foreground hover:text-foreground"
                        }`}
                      >
                        <span>{SHIPPING_LABELS[method]}</span>
                        <span>{fee === 0 ? "Free" : formatPrice(fee)}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className={labelCls}>Payment</legend>
                <div className="mt-3 flex flex-col gap-2">
                  {paymentOptions.map((option) => {
                    const selected = paymentMethod === option.method;
                    return (
                      <button
                        key={option.method}
                        type="button"
                        disabled={!option.available}
                        onClick={() => {
                          if (option.available) setPaymentMethod(option.method);
                        }}
                        className={`flex h-11 items-center justify-between rounded-[2px] border px-3 text-left text-xs font-medium uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:cursor-not-allowed disabled:opacity-40 ${
                          selected
                            ? "border-foreground bg-foreground text-background"
                            : "border-subtle text-muted hover:border-foreground hover:text-foreground"
                        }`}
                      >
                        <span>{option.label}</span>
                        {!option.available && <span>Coming soon</span>}
                        {option.available && option.testMode && (
                          <span>Test mode</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedPayment && (
                  <p className="mt-2 text-xs leading-6 text-muted">
                    {selectedPayment.note}
                  </p>
                )}
              </fieldset>

              <p className={labelCls}>
                {pickup ? "Your details" : "Delivery details"}
              </p>

              {(addresses ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(addresses ?? []).map((address) => {
                    const active = savedAddress?.id === address.id;
                    return (
                      <button
                        key={address.id}
                        type="button"
                        onClick={() => setAddressId(address.id)}
                        className={chipCls(active)}
                      >
                        {address.label || address.city || "Saved"}
                        {address.isDefault ? " ·" : ""}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setAddressId("")}
                    className={chipCls(savedAddress === null)}
                  >
                    New address
                  </button>
                </div>
              )}

              <div className="grid gap-4">
                {!user && (
                  <Field id="ship-email" label="Email">
                    <input
                      id="ship-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={inputCls}
                    />
                  </Field>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Field id="ship-first" label="Name">
                    <input
                      id="ship-first"
                      name="firstName"
                      required
                      defaultValue={savedAddress?.firstName ?? ""}
                      autoComplete="given-name"
                      className={inputCls}
                    />
                  </Field>
                  <Field id="ship-last" label="Last name">
                    <input
                      id="ship-last"
                      name="lastName"
                      required
                      defaultValue={savedAddress?.lastName ?? ""}
                      autoComplete="family-name"
                      className={inputCls}
                    />
                  </Field>
                </div>
                {!pickup && (
                  <Field id="ship-line1" label="Address">
                    <input
                      id="ship-line1"
                      name="line1"
                      required
                      defaultValue={savedAddress?.line1 ?? ""}
                      autoComplete="street-address"
                      className={inputCls}
                    />
                  </Field>
                )}
                <Field id="ship-phone" label="Phone">
                  <input
                    id="ship-phone"
                    name="phone"
                    type="tel"
                    required
                    minLength={9}
                    inputMode="tel"
                    placeholder="555 12 34 56"
                    autoComplete="tel"
                    defaultValue={savedAddress?.phone ?? ""}
                    className={inputCls}
                  />
                </Field>
                {!pickup && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field id="ship-city" label="City">
                      <input
                        id="ship-city"
                        name="city"
                        required
                        defaultValue={savedAddress?.city ?? ""}
                        autoComplete="address-level2"
                        className={inputCls}
                      />
                    </Field>
                    <Field id="ship-region" label="Region">
                      <select
                        id="ship-region"
                        name="region"
                        defaultValue={savedAddress?.region ?? "Tbilisi"}
                        className={selectCls}
                      >
                        {regions.map((region) => (
                          <option key={region} value={region}>
                            {region}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={checkingOut}
                className={`${btnSolid} w-full`}
              >
                {checkingOut ? "Placing order…" : "Place order"}
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
