"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import type { Order, OrderStatus } from "@/lib/api";
import { PAYMENT_LABELS, SHIPPING_LABELS } from "@/lib/checkout";
import { formatDate, formatPrice, shortId } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import { XIcon } from "../icons";
import {
  btnGhostSm,
  btnSolidSm,
  chipCls,
  inputCls,
  labelCls,
  Loading,
  selectCls,
} from "../ui";

const COLUMNS: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "Created" },
  { status: "paid", label: "Paid" },
  { status: "packed", label: "Packed" },
  { status: "shipped", label: "Out" },
  { status: "delivered", label: "Delivered" },
  { status: "cancelled", label: "Cancelled" },
];

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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
                className="flex size-9 items-center justify-center rounded-[2px] border border-subtle text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
              >
                ←
              </button>
              <p className="min-w-36 text-center text-xs font-bold uppercase tracking-[0.1em]">
                {MONTH_NAMES[month]} {year}
              </p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                className="flex size-9 items-center justify-center rounded-[2px] border border-subtle text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
              >
                →
              </button>
            </>
          )}
        </div>
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
          Drag cards anywhere · click a card for details
        </p>
      </div>
      <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted">
        {note}
      </p>

      {loading ? (
        <Loading label="Loading board" />
      ) : (
        <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 xl:grid xl:grid-cols-6 xl:overflow-visible">
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
                className={`w-64 shrink-0 snap-start rounded-[2px] border xl:w-auto ${
                  dropTarget === status && canDropHere
                    ? "border-foreground"
                    : canDropHere
                      ? "border-muted"
                      : "border-subtle"
                }`}
              >
                <header className="flex items-baseline justify-between gap-2 border-b border-subtle px-3 py-2.5">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]">
                    {label}
                  </h3>
                  <span className="text-[11px] font-medium text-muted">
                    {board[status].length}
                  </span>
                </header>
                <ul className="flex min-h-24 flex-col gap-2 p-2">
                  {board[status].map((order) => (
                    <li
                      key={order.id}
                      draggable
                      onDragStart={() => setDragging(order)}
                      onDragEnd={() => {
                        setDragging(null);
                        setDropTarget(null);
                      }}
                      className={`cursor-grab rounded-[2px] border border-subtle bg-background transition-colors hover:border-foreground ${
                        dragging?.id === order.id ? "opacity-40" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelected(order)}
                        className="w-full rounded-[2px] p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-[11px] font-bold uppercase tracking-wide">
                            #{shortId(order.id)}
                          </p>
                          <p className="text-[10px] text-muted">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-muted">
                          {order.user?.username ?? "deleted user"} ·{" "}
                          {order.items.length}{" "}
                          {order.items.length === 1 ? "item" : "items"}
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          {formatPrice(order.totalCents)}
                        </p>
                      </button>
                    </li>
                  ))}
                  {board[status].length === 0 && (
                    <li className="py-6 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                      Empty
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const address = order.shippingAddress;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Order ${shortId(order.id)}`}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full overflow-y-auto border border-foreground bg-background p-5 sm:max-w-lg sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold uppercase tracking-wide">
              #{shortId(order.id)}
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
              {formatDate(order.createdAt)} · {order.status} ·{" "}
              {order.user
                ? `${order.user.username} (${order.user.email})`
                : "deleted user"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-[2px] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <ul className="mt-4 border-t border-subtle">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 border-b border-subtle py-2.5 text-sm"
            >
              <span className="min-w-0 truncate">
                {item.quantity} × {item.productName}
                {item.size ? ` (${item.size})` : ""}
              </span>
              <span className="shrink-0 font-bold">
                {formatPrice(item.unitPriceCents * item.quantity)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 py-2.5 text-sm font-bold">
            <span>Total</span>
            <span>{formatPrice(order.totalCents)}</span>
          </li>
        </ul>

        <p className="mt-3 text-xs leading-6 text-muted">
          {order.paymentMethod
            ? (PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod)
            : "Payment —"}
          {" · "}
          {order.shippingMethod
            ? (SHIPPING_LABELS[order.shippingMethod] ?? order.shippingMethod)
            : "Shipping —"}
          {(order.shippingCents ?? 0) > 0
            ? ` (${formatPrice(order.shippingCents ?? 0)})`
            : ""}
        </p>

        {address && (
          <p className="mt-3 text-xs leading-6 text-muted">
            Ship to:{" "}
            {[
              [address.firstName, address.lastName]
                .filter(Boolean)
                .join(" ") || address.fullName,
              address.line1,
              address.city,
              address.postalCode,
              address.country,
              address.phone,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-4 border-t border-subtle pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={labelCls}>Status</span>
            <select
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={labelCls}>Order date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} h-10 w-auto`}
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
              className={btnSolidSm}
            >
              Move
            </button>
          </div>

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
            className={`${btnGhostSm} self-start`}
          >
            Delete this order
          </button>
          <p aria-live="polite" className="min-h-4 text-xs text-muted">
            {note}
          </p>
        </div>
      </div>
    </div>
  );
}
