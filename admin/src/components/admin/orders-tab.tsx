"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import type { Order, OrderStatus } from "@/lib/api";
import { SHIPPING_LABELS, paymentLabel, variantLabel } from "@/lib/checkout";
import { formatDate, formatPrice, shortId } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import { XIcon } from "../icons";
import {
  Badge,
  btnDanger,
  btnGhost,
  btnIcon,
  btnPrimarySm,
  btnSecondarySm,
  cardCls,
  chipCls,
  eyebrow,
  Facts,
  Field,
  inputCls,
  Loading,
  Note,
  Panel,
  selectCls,
  type Tone,
} from "../ui";

const COLUMNS: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "Created" },
  { status: "paid", label: "Paid" },
  { status: "packed", label: "Packed" },
  { status: "shipped", label: "Out" },
  { status: "delivered", label: "Delivered" },
  { status: "cancelled", label: "Cancelled" },
];

/* Colour is the fastest way to tell a stuck order from a settled one, so the
   status carries a tone everywhere it appears. Never decoration. */
const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending: "caution",
  paid: "info",
  packed: "info",
  shipped: "info",
  delivered: "positive",
  cancelled: "neutral",
};

function statusLabel(status: OrderStatus): string {
  return COLUMNS.find((c) => c.status === status)?.label ?? status;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Board = Record<OrderStatus, Order[]>;

const EMPTY_BOARD: Board = {
  pending: [],
  paid: [],
  packed: [],
  shipped: [],
  delivered: [],
  cancelled: [],
};

function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(year, month + 1, 0).getDate();
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(last)}`,
  };
}

export function OrdersTab() {
  const now = new Date();
  const [allTime, setAllTime] = useState(true);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Order | null>(null);
  const [dropTarget, setDropTarget] = useState<OrderStatus | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setNote(null);
    const range = allTime ? {} : monthRange(year, month);
    try {
      const results = await Promise.all(
        COLUMNS.map(({ status }) =>
          adminApi.listOrders({ status, page: 1, pageSize: 30, ...range }),
        ),
      );
      const next: Board = { ...EMPTY_BOARD };
      COLUMNS.forEach(({ status }, i) => {
        next[status] = results[i].items;
      });
      setBoard(next);
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [allTime, year, month]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function move(order: Order, next: OrderStatus) {
    if (order.status === next) return;
    setBoard((b) => ({
      ...b,
      [order.status]: b[order.status].filter((o) => o.id !== order.id),
      [next]: [{ ...order, status: next }, ...b[next]],
    }));
    setNote(null);
    try {
      await adminApi.updateOrderStatus(order.id, next);
      setSelected((s) => (s?.id === order.id ? { ...s, status: next } : s));
    } catch (err) {
      setNote(errorMessage(err));
      void loadAll();
    }
  }

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel eyebrow="Fulfilment" title="The board" bleed>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAllTime(true)}
              className={chipCls(allTime)}
            >
              All time
            </button>
            <button
              type="button"
              onClick={() => setAllTime(false)}
              className={chipCls(!allTime)}
            >
              By month
            </button>
            {!allTime && (
              <>
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => shiftMonth(-1)}
                  className={btnIcon}
                >
                  ←
                </button>
                <p className="tnum min-w-36 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
                  {MONTH_NAMES[month]} {year}
                </p>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => shiftMonth(1)}
                  className={btnIcon}
                >
                  →
                </button>
              </>
            )}
          </div>
          <p className="text-[11px] text-faint">
            Drag a card between columns · click one for the detail
          </p>
        </div>

        <div className="px-5 pt-3">
          <Note>{note}</Note>
        </div>

        {loading ? (
          <div className="px-5 pb-2">
            <Loading label="Loading board" />
          </div>
        ) : (
          <div className="flex snap-x gap-3 overflow-x-auto px-5 pb-5 pt-2 xl:grid xl:grid-cols-6 xl:overflow-visible">
            {COLUMNS.map(({ status, label }) => {
              const canDropHere =
                dragging !== null && dragging.status !== status;
              return (
                <section
                  key={status}
                  aria-label={`${label} orders`}
                  onDragOver={(e) => {
                    if (canDropHere) {
                      e.preventDefault();
                      setDropTarget(status);
                    }
                  }}
                  onDragLeave={() =>
                    setDropTarget((t) => (t === status ? null : t))
                  }
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragging && canDropHere) void move(dragging, status);
                    setDragging(null);
                    setDropTarget(null);
                  }}
                  className={`w-64 shrink-0 snap-start rounded-[var(--radius-card)] border bg-raised transition-colors xl:w-auto ${
                    dropTarget === status && canDropHere
                      ? "border-ink"
                      : canDropHere
                        ? "border-line-strong"
                        : "border-line"
                  }`}
                >
                  <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <h3>
                      <Badge tone={STATUS_TONE[status]}>{label}</Badge>
                    </h3>
                    <span className="tnum text-[11px] font-semibold text-faint">
                      {board[status].length}
                    </span>
                  </header>
                  <ul className="flex min-h-24 flex-col gap-2 px-2 pb-2">
                    {board[status].map((order) => (
                      <li
                        key={order.id}
                        draggable
                        onDragStart={() => setDragging(order)}
                        onDragEnd={() => {
                          setDragging(null);
                          setDropTarget(null);
                        }}
                        className={`cursor-grab rounded-[var(--radius-control)] border border-line bg-card transition-colors hover:border-line-strong ${
                          dragging?.id === order.id ? "opacity-40" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelected(order)}
                          className="w-full rounded-[var(--radius-control)] p-3 text-left"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="tnum text-[12px] font-bold text-ink">
                              #{shortId(order.id)}
                            </p>
                            <p className="tnum text-[11px] text-faint">
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <p className="mt-1 truncate text-[11px] text-faint">
                            {order.user?.username ?? "deleted user"} ·{" "}
                            {order.items.length}{" "}
                            {order.items.length === 1 ? "item" : "items"}
                          </p>
                          <p className="tnum mt-1.5 text-right text-[13px] font-bold text-ink">
                            {formatPrice(order.totalCents)}
                          </p>
                        </button>
                      </li>
                    ))}
                    {board[status].length === 0 && (
                      <li className="py-6 text-center text-[11px] text-faint">
                        Nothing here
                      </li>
                    )}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </Panel>

      {selected && (
        <OrderDetails
          order={selected}
          onClose={() => setSelected(null)}
          onMove={move}
          onChanged={() => {
            setSelected(null);
            void loadAll();
          }}
        />
      )}
    </div>
  );
}

function OrderDetails({
  order,
  onClose,
  onMove,
  onChanged,
}: {
  order: Order;
  onClose: () => void;
  onMove: (order: Order, next: OrderStatus) => Promise<void>;
  onChanged: () => void;
}) {
  const [date, setDate] = useState(order.createdAt.slice(0, 10));
  const [note, setNote] = useState<string | null>(null);
  const [carrier, setCarrier] = useState(order.trackingCarrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(
    order.trackingNumber ?? "",
  );
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl ?? "");
  const [savingTracking, setSavingTracking] = useState(false);

  async function saveTracking() {
    setSavingTracking(true);
    setNote(null);
    try {
      await adminApi.setOrderTracking(order.id, {
        trackingCarrier: carrier,
        trackingNumber,
        trackingUrl,
      });
      setNote(
        "Tracking saved. It goes out with the email when you mark this shipped.",
      );
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setSavingTracking(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const address = order.shippingAddress;

  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: "Payment",
      value: order.paymentMethod ? paymentLabel(order.paymentMethod) : "—",
    },
    {
      label: "Shipping",
      value: `${
        order.shippingMethod
          ? (SHIPPING_LABELS[order.shippingMethod] ?? order.shippingMethod)
          : "—"
      }${
        (order.shippingCents ?? 0) > 0
          ? ` (${formatPrice(order.shippingCents ?? 0)})`
          : ""
      }`,
    },
  ];
  if (address) {
    facts.push({
      label: "Ship to",
      value: [
        [address.firstName, address.lastName].filter(Boolean).join(" ") ||
          address.fullName,
        address.line1,
        address.city,
        address.postalCode,
        address.country,
        address.phone,
      ]
        .filter(Boolean)
        .join(", "),
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Order ${shortId(order.id)}`}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${cardCls} max-h-[90dvh] w-full overflow-y-auto p-5 shadow-[var(--shadow-pop)] sm:max-w-lg`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={eyebrow}>Order</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="font-display tnum text-[22px] leading-none">
                #{shortId(order.id)}
              </h2>
              <Badge tone={STATUS_TONE[order.status]}>
                {statusLabel(order.status)}
              </Badge>
            </div>
            <p className="mt-2 text-[11px] text-faint">
              {formatDate(order.createdAt)} ·{" "}
              {order.user
                ? `${order.user.username} (${order.user.email})`
                : "deleted user"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={btnIcon}
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="mt-4 rounded-[var(--radius-control)] border border-line bg-raised p-4">
          <table className="w-full text-[12px]">
            <caption className={`${eyebrow} pb-2 text-left`}>Items</caption>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="py-2 pr-3 text-ink">
                    {item.quantity} × {item.productName}
                    {variantLabel(item.color, item.size)
                      ? ` (${variantLabel(item.color, item.size)})`
                      : ""}
                  </td>
                  <td className="tnum py-2 text-right font-semibold text-ink">
                    {formatPrice(item.unitPriceCents * item.quantity)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line-strong">
                <td className={`${eyebrow} py-2 pr-3`}>Total</td>
                <td className="tnum py-2 text-right text-[13px] font-bold text-ink">
                  {formatPrice(order.totalCents)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 border-t border-line pt-3">
            <Facts rows={facts} />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
          <p className={eyebrow}>Tracking</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="order-carrier" label="Carrier">
              <input
                id="order-carrier"
                value={carrier}
                placeholder="Carrier"
                onChange={(e) => setCarrier(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field id="order-tracking-number" label="Tracking number">
              <input
                id="order-tracking-number"
                value={trackingNumber}
                placeholder="Tracking number"
                onChange={(e) => setTrackingNumber(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <Field id="order-tracking-url" label="Tracking URL">
            <input
              id="order-tracking-url"
              value={trackingUrl}
              placeholder="https://carrier.example/track/..."
              onChange={(e) => setTrackingUrl(e.target.value)}
              className={inputCls}
            />
          </Field>
          <button
            type="button"
            disabled={savingTracking}
            onClick={saveTracking}
            className={`${btnSecondarySm} self-start`}
          >
            {savingTracking ? "Saving…" : "Save tracking"}
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-line pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="order-status" label="Status">
              <select
                id="order-status"
                value={order.status}
                onChange={(e) => onMove(order, e.target.value as OrderStatus)}
                className={selectCls}
              >
                {COLUMNS.map(({ status, label }) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="order-date" label="Order date">
              <div className="flex items-center gap-2">
                <input
                  id="order-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`${inputCls} w-auto flex-1`}
                />
                <button
                  type="button"
                  onClick={async () => {
                    setNote(null);
                    try {
                      await adminApi.updateOrderDate(order.id, date);
                      setNote("Order date updated.");
                      onChanged();
                    } catch (err) {
                      setNote(errorMessage(err));
                    }
                  }}
                  className={btnPrimarySm}
                >
                  Move
                </button>
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`Delete order #${shortId(order.id)} forever?`))
                  return;
                setNote(null);
                try {
                  await adminApi.deleteOrder(order.id);
                  onChanged();
                } catch (err) {
                  setNote(errorMessage(err));
                }
              }}
              className={btnDanger}
            >
              Delete this order
            </button>
            <button type="button" onClick={onClose} className={btnGhost}>
              Close
            </button>
          </div>
          <Note>{note}</Note>
        </div>
      </div>
    </div>
  );
}
