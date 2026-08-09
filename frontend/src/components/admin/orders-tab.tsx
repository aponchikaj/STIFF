"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import type { Order, OrderStatus } from "@/lib/api";
import { formatDate, formatPrice, shortId } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import { Loading } from "../ui";

const COLUMNS: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "Created" },
  { status: "paid", label: "Paid" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
  { status: "cancelled", label: "Cancelled" },
];

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

const MOVE_LABEL: Record<OrderStatus, string> = {
  pending: "Created",
  paid: "Paid",
  shipped: "Ship",
  delivered: "Deliver",
  cancelled: "Cancel",
};

type Board = Record<OrderStatus, Order[]>;

const EMPTY_BOARD: Board = {
  pending: [],
  paid: [],
  shipped: [],
  delivered: [],
  cancelled: [],
};

export function OrdersTab() {
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Order | null>(null);
  const [dropTarget, setDropTarget] = useState<OrderStatus | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setNote(null);
    try {
      const results = await Promise.all(
        COLUMNS.map(({ status }) =>
          adminApi.listOrders({ status, page: 1, pageSize: 25 }),
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
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function move(order: Order, next: OrderStatus) {
    if (!NEXT_STATUSES[order.status].includes(next)) return;
    // Optimistic move, reconciled on error.
    setBoard((b) => ({
      ...b,
      [order.status]: b[order.status].filter((o) => o.id !== order.id),
      [next]: [{ ...order, status: next }, ...b[next]],
    }));
    setNote(null);
    try {
      await adminApi.updateOrderStatus(order.id, next);
    } catch (err) {
      setNote(errorMessage(err));
      void loadAll();
    }
  }

  if (loading) return <Loading label="Loading board" />;

  return (
    <div>
      <p aria-live="polite" className="min-h-4 text-xs text-muted">
        {note ?? "Drag a card to the next column, or use the buttons on each card."}
      </p>
      <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 xl:grid xl:grid-cols-5 xl:overflow-visible">
        {COLUMNS.map(({ status, label }) => {
          const canDropHere =
            dragging !== null &&
            NEXT_STATUSES[dragging.status].includes(status);
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
                    draggable={NEXT_STATUSES[status].length > 0}
                    onDragStart={() => setDragging(order)}
                    onDragEnd={() => {
                      setDragging(null);
                      setDropTarget(null);
                    }}
                    className={`rounded-[2px] border border-subtle bg-background p-3 ${
                      NEXT_STATUSES[status].length > 0 ? "cursor-grab" : ""
                    } ${dragging?.id === order.id ? "opacity-40" : ""}`}
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
                    {order.shippingAddress?.city && (
                      <p className="mt-1 truncate text-[10px] uppercase tracking-[0.1em] text-muted">
                        → {order.shippingAddress.city}
                        {order.shippingAddress.country
                          ? `, ${order.shippingAddress.country}`
                          : ""}
                      </p>
                    )}
                    {NEXT_STATUSES[status].length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {NEXT_STATUSES[status].map((next) => (
                          <button
                            key={next}
                            type="button"
                            onClick={() => move(order, next)}
                            className={`flex h-7 items-center rounded-[2px] px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
                              next === "cancelled"
                                ? "border border-subtle text-muted hover:border-foreground hover:text-foreground"
                                : "bg-foreground text-background hover:opacity-80"
                            }`}
                          >
                            {MOVE_LABEL[next]} →
                          </button>
                        ))}
                      </div>
                    )}
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
    </div>
  );
}
