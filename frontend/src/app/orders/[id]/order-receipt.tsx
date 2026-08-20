"use client";

import Link from "next/link";
import { useState } from "react";
import { cartApi, returnsApi } from "@/lib/api";
import type { Order, ReturnStatus } from "@/lib/api";
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
  ErrorNote,
  inputCls,
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

const RETURN_LABEL: Record<ReturnStatus, string> = {
  requested: "Return requested",
  approved: "Return approved",
  rejected: "Return not accepted",
  received: "Return received",
  refunded: "Refunded",
};

/** The order's journey, so someone can see where it has got to at a glance. */
const STEPS = ["pending", "paid", "packed", "shipped", "delivered"] as const;

export function OrderReceipt({ id }: { id: string }) {
  const { user } = useSession();
  const { data: order, setData: setOrder, loading, error } = useAsync<Order>(
    () => cartApi.getOrder(id),
    [id],
  );
  const { data: returnsData, reload: reloadReturns } = useAsync(
    () => returnsApi.getForOrder(id),
    [id],
  );

  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showReturn, setShowReturn] = useState(false);

  if (loading) return <Loading label="Loading order" />;
  if (error || !order) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
          Not found
        </h1>
        <p className="text-sm leading-7 text-muted">
          We can&apos;t find that order. Check the link from your confirmation
          email — or sign in, if you placed it with an account.
        </p>
        <Link href="/" className={btnOutline}>
          Back home
        </Link>
      </div>
    );
  }

  const cancelled = order.status === "cancelled";
  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const canCancel = order.status === "pending" || order.status === "paid";
  const eligibility = returnsData?.eligibility;
  const requests = returnsData?.requests ?? [];

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
        {eligibility?.allowed && !showReturn && (
          <button
            type="button"
            onClick={() => setShowReturn(true)}
            className={btnOutline}
          >
            Request a return
          </button>
        )}
        <Link href="/clothing" className={btnSolid}>
          Keep shopping
        </Link>
      </div>

      {/* Why a return is not offered — better than a missing button */}
      {eligibility && !eligibility.allowed && !cancelled && requests.length === 0 && (
        <p className="mt-4 text-xs leading-6 text-muted">{eligibility.reason}</p>
      )}

      {showReturn && eligibility?.allowed && (
        <ReturnForm
          order={order}
          onDone={() => {
            setShowReturn(false);
            reloadReturns();
          }}
        />
      )}

      {requests.length > 0 && (
        <section className="mt-10" aria-label="Returns">
          <h2 className="text-2xl uppercase tracking-tight">Returns</h2>
          <ul className="mt-4 border-t border-subtle">
            {requests.map((request) => (
              <li key={request.id} className="border-b border-subtle py-4">
                <p className="text-sm font-bold uppercase tracking-wide">
                  {RETURN_LABEL[request.status]}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Requested {formatDate(request.createdAt)}
                  {request.refundCents > 0 &&
                    ` · refunded ${formatPrice(request.refundCents)}`}
                </p>
                {request.resolutionNote && (
                  <p className="mt-2 border-l-2 border-subtle pl-3 text-sm leading-6 text-muted">
                    {request.resolutionNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!user && (
        <p className="mt-10 text-xs leading-6 text-muted">
          Keep this page — it is how you check on this order. Make an account
          with the same email to see it in your order history.
        </p>
      )}
    </section>
  );
}

function ReturnForm({
  order,
  onDone,
}: {
  order: Order;
  onDone: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const chosen = Object.entries(quantities).filter(([, qty]) => qty > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (chosen.length === 0) {
      setNote("Pick at least one piece to send back.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await returnsApi.requestReturn(order.id, {
        items: chosen.map(([orderItemId, quantity]) => ({
          orderItemId,
          quantity,
        })),
        reason: reason.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 border border-subtle p-4">
      <p className={labelCls}>What are you sending back?</p>
      <p className="mt-1 text-xs leading-6 text-muted">
        Unworn, tags on. We&apos;ll confirm before you post anything.
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4">
            <label
              htmlFor={`ret-${item.id}`}
              className="min-w-0 flex-1 text-sm"
            >
              <span className="block truncate font-medium">
                {item.productName}
              </span>
              <span className="text-xs text-muted">
                {variantLabel(item.color, item.size)
                  ? `${variantLabel(item.color, item.size)} · `
                  : ""}
                ordered {item.quantity}
              </span>
            </label>
            <input
              id={`ret-${item.id}`}
              type="number"
              min={0}
              max={item.quantity}
              value={quantities[item.id] ?? 0}
              onChange={(e) =>
                setQuantities((q) => ({
                  ...q,
                  [item.id]: Math.max(
                    0,
                    Math.min(item.quantity, Number(e.target.value) || 0),
                  ),
                }))
              }
              className={`${inputCls} w-20`}
            />
          </li>
        ))}
      </ul>

      <label htmlFor="ret-reason" className={`${labelCls} mt-5 block`}>
        Why? (optional)
      </label>
      <textarea
        id="ret-reason"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Didn't fit, arrived damaged, changed my mind…"
        className={`${inputCls} mt-2 h-auto py-2`}
      />

      {note && <ErrorNote message={note} />}

      <div className="mt-4 flex gap-3">
        <button type="submit" disabled={busy} className={btnSolid}>
          {busy ? "Sending…" : "Request return"}
        </button>
        <button type="button" onClick={onDone} className={btnOutline}>
          Cancel
        </button>
      </div>
    </form>
  );
}
