"use client";

import Link from "next/link";
import { useState } from "react";
import { cartApi } from "@/lib/api";
import type { Order } from "@/lib/api";
import { SHIPPING_LABELS, paymentLabel, variantLabel } from "@/lib/checkout";
import type { ShippingMethod } from "@/lib/checkout";
import { formatDate, formatPrice, shortId } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { Reveal } from "@/components/motion";
import { ProductImage } from "@/components/product-image";
import { useSession } from "@/components/providers";
import {
  btnGhostSm,
  btnOutline,
  btnSolid,
  labelCls,
  Loading,
} from "@/components/ui";

const STATUS_LABEL: Record<string, string> = {
  pending: "Placed",
  paid: "Paid",
  packed: "Packed",
  shipped: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};


/** The order's journey, so someone can see where it has got to at a glance. */
const STEPS = ["pending", "paid", "packed", "shipped", "delivered"] as const;

export function OrderReceipt({ id }: { id: string }) {
  const { user } = useSession();
  const { data: order, setData: setOrder, loading, error } = useAsync<Order>(
    () => cartApi.getOrder(id),
    [id],
  );
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading label="Loading order" />;
  if (error || !order) {
    // The order exists but now belongs to an account — which is what happens
    // to a guest order once its email is verified. Whoever is holding this
    // link needs a way in, not a dead end.
    const needsSignIn = /sign in/i.test(error ?? "");
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
          {needsSignIn ? "Sign in" : "Not found"}
        </h1>
        <p className="text-sm leading-7 text-muted">
          {needsSignIn
            ? "This order is linked to an account now. Sign in with the email you ordered with and it will be in your order history."
            : "We can't find that order. Check the link from your confirmation email — or sign in, if you placed it with an account."}
        </p>
        <Link
          href={
            needsSignIn
              ? `/login?next=${encodeURIComponent(`/orders/${id}`)}`
              : "/"
          }
          className={btnOutline}
        >
          {needsSignIn ? "Sign in" : "Back home"}
        </Link>
      </div>
    );
  }

  // A guest order: no account owns it, and the only ways back are this link
  // and the invoice email.
  const isGuestOrder = !order.userId && !!order.guestEmail;

  const cancelled = order.status === "cancelled";
  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const canCancel = order.status === "pending" || order.status === "paid";

  async function cancel() {
    if (!order) return;
    setBusy(true);
    setNote(null);
    try {
      const updated = await cartApi.cancelOrder(order.id);
      setOrder(updated);
      setNote("Order cancelled. Anything you paid will be returned to you.");
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Reveal>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          Order #{shortId(order.id)} · {formatDate(order.createdAt)}
        </p>
        <h1 className="mt-2 text-4xl uppercase tracking-tight sm:text-6xl">
          {cancelled ? "Cancelled" : STATUS_LABEL[order.status] ?? order.status}
        </h1>
      </Reveal>

      {isGuestOrder && (
        // Offered here because this is the one moment the order is in front of
        // them. Afterwards the only ways back are this link and the invoice
        // email, and both are easy to lose.
        <div className="mt-6 border border-subtle p-4">
          <p className="text-xs leading-6 text-muted">
            You ordered as a guest. Make an account with{" "}
            <span className="font-medium text-foreground">
              {order.guestEmail}
            </span>{" "}
            and this order moves into your history as soon as you verify the
            address — no need to keep this link.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href={`/register?next=${encodeURIComponent(`/orders/${id}`)}`}
              className={btnGhostSm}
            >
              Create account
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(`/orders/${id}`)}`}
              className={btnGhostSm}
            >
              I already have one
            </Link>
          </div>
        </div>
      )}

      {/* Progress */}
      {!cancelled && (
        <ol className="mt-8 grid grid-cols-5 gap-1" aria-label="Order progress">
          {STEPS.map((step, i) => (
            <li key={step} className="flex flex-col gap-1.5">
              <div
                className={`h-1 w-full ${
                  i <= stepIndex ? "bg-foreground" : "bg-subtle"
                }`}
              />
              <span
                className={`text-[9px] font-medium uppercase tracking-[0.12em] ${
                  i <= stepIndex ? "text-foreground" : "text-muted"
                }`}
              >
                {STATUS_LABEL[step]}
              </span>
            </li>
          ))}
        </ol>
      )}

      {cancelled && (
        <p className="mt-6 border border-subtle p-4 text-sm leading-6 text-muted">
          This order was cancelled
          {order.cancelledBy === "customer" ? " at your request" : " by us"}
          {order.cancelledAt ? ` on ${formatDate(order.cancelledAt)}` : ""}. The
          pieces went back into stock.
        </p>
      )}

      {/* Tracking */}
      {order.trackingNumber && !cancelled && (
        <div className="mt-8 border border-subtle p-4">
          <p className={labelCls}>Tracking</p>
          <p className="mt-2 text-sm text-muted">
            {order.trackingCarrier ? `${order.trackingCarrier} · ` : ""}
            <span className="font-bold text-foreground">
              {order.trackingNumber}
            </span>
          </p>
          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={`${btnGhostSm} mt-3 inline-flex`}
            >
              Track the parcel
            </a>
          )}
        </div>
      )}

      {/* Items */}
      <ul className="mt-10 border-t border-subtle">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-4 border-b border-subtle py-4"
          >
            <div className="size-16 shrink-0 bg-surface">
              {item.productImage && (
                <ProductImage
                  src={item.productImage}
                  alt={item.productName}
                  width={64}
                  height={64}
                  className="size-16 object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold uppercase tracking-wide">
                {item.productName}
              </p>
              <p className="text-xs text-muted">
                {variantLabel(item.color, item.size)
                  ? `${variantLabel(item.color, item.size)} · `
                  : ""}
                {item.quantity} × {formatPrice(item.unitPriceCents)}
              </p>
            </div>
            <p className="text-sm font-bold">
              {formatPrice(item.unitPriceCents * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      {/* Totals */}
      <dl className="mt-6 flex flex-col gap-2 text-sm">
        <div className="flex justify-between text-muted">
          <dt>{SHIPPING_LABELS[order.shippingMethod as ShippingMethod] ?? "Shipping"}</dt>
          <dd>
            {order.shippingCents
              ? formatPrice(order.shippingCents)
              : "Free"}
          </dd>
        </div>
        <div className="flex justify-between text-muted">
          <dt>Payment</dt>
          <dd>{paymentLabel(order.paymentMethod)}</dd>
        </div>
        <div className="flex justify-between border-t border-subtle pt-3 text-base font-bold">
          <dt>Total</dt>
          <dd>{formatPrice(order.totalCents)}</dd>
        </div>
      </dl>

      {note && <p className="mt-4 text-sm text-muted">{note}</p>}

      {/* Actions */}
      <div className="mt-8 flex flex-wrap gap-3">
        {canCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={cancel}
            className={btnOutline}
          >
            {busy ? "Cancelling…" : "Cancel this order"}
          </button>
        )}
        <Link href="/clothing" className={btnSolid}>
          Keep shopping
        </Link>
      </div>

      {!user && (
        <p className="mt-10 text-xs leading-6 text-muted">
          Keep this page — it is how you check on this order. Make an account
          with the same email to see it in your order history.
        </p>
      )}
    </section>
  );
}
