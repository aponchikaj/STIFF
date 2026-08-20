"use client";

import { useCallback, useEffect, useState } from "react";
import { returnsApi } from "@/lib/api";
import type { ReturnRequest, ReturnStatus } from "@/lib/api";
import { formatDate, formatPrice, shortId } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import {
  btnGhostSm,
  btnSolidSm,
  chipCls,
  ErrorNote,
  inputCls,
  labelCls,
  Loading,
  textareaCls,
} from "../ui";

const FILTERS: { value: ReturnStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "received", label: "Received" },
  { value: "refunded", label: "Refunded" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  received: "Received",
  refunded: "Refunded",
};

/**
 * The moves each status allows. Mirrors `return-rules.ts` on the backend — the
 * server is still the authority, this only keeps the UI from offering a button
 * that would be refused.
 */
const NEXT: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["received", "rejected"],
  received: ["refunded", "rejected"],
  rejected: [],
  refunded: [],
};

export function ReturnsTab() {
  const [filter, setFilter] = useState<ReturnStatus | "all">("requested");
  const [items, setItems] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNote(null);
    try {
      const result = await returnsApi.listReturns({
        status: filter === "all" ? undefined : filter,
        page: 1,
        pageSize: 50,
      });
      setItems(result.items);
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={chipCls(filter === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {note && <ErrorNote message={note} />}
      {loading && <Loading label="Loading returns" />}

      {!loading && items.length === 0 && (
        <p className="py-16 text-sm text-muted">
          Nothing here. Returns customers request will land in this list.
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {items.map((request) => (
          <ReturnCard key={request.id} request={request} onChanged={load} />
        ))}
      </ul>
    </div>
  );
}

function ReturnCard({
  request,
  onChanged,
}: {
  request: ReturnRequest;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [resolution, setResolution] = useState(request.resolutionNote);
  const [refund, setRefund] = useState(
    request.refundCents ? String(request.refundCents / 100) : "",
  );

  const moves = NEXT[request.status];
  const order = request.order;

  async function move(status: ReturnStatus) {
    if (status === "rejected" && !resolution.trim()) {
      setNote("Say why before rejecting — the customer is told this verbatim.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await returnsApi.resolveReturn(request.id, {
        status,
        resolutionNote: resolution.trim() || undefined,
        refundCents:
          status === "refunded"
            ? Math.round(Number(refund) * 100) || 0
            : undefined,
      });
      onChanged();
    } catch (err) {
      setNote(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <li className="border border-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide">
            Order #{shortId(request.orderId)}
            {order ? ` · ${formatPrice(order.totalCents)}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">
            {STATUS_LABEL[request.status]} · requested{" "}
            {formatDate(request.createdAt)}
            {request.resolvedAt && ` · resolved ${formatDate(request.resolvedAt)}`}
          </p>
        </div>
        <a
          href={`/orders/${request.orderId}`}
          target="_blank"
          rel="noreferrer noopener"
          className={btnGhostSm}
        >
          Open order
        </a>
      </div>

      <ul className="mt-3 flex flex-col gap-1 text-xs text-muted">
        {request.items.map((item) => {
          const line = order?.items?.find((i) => i.id === item.orderItemId);
          return (
            <li key={item.id}>
              {item.quantity} ×{" "}
              {line
                ? `${line.productName}${line.size ? ` (${line.size})` : ""}`
                : "item no longer on the order"}
            </li>
          );
        })}
      </ul>

      {request.reason && (
        <p className="mt-3 border-l-2 border-subtle pl-3 text-sm leading-6 text-muted">
          {request.reason}
        </p>
      )}

      {moves.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor={`res-${request.id}`} className={labelCls}>
              Note to the customer
            </label>
            <textarea
              id={`res-${request.id}`}
              rows={2}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Required when rejecting. Sent to them as written."
              className={`${textareaCls} mt-2`}
            />
          </div>

          {moves.includes("refunded") && (
            <div className="max-w-40">
              <label htmlFor={`ref-${request.id}`} className={labelCls}>
                Refund amount
              </label>
              <input
                id={`ref-${request.id}`}
                type="number"
                min="0"
                step="0.01"
                value={refund}
                onChange={(e) => setRefund(e.target.value)}
                className={`${inputCls} mt-2`}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {moves.map((status) => (
              <button
                key={status}
                type="button"
                disabled={busy}
                onClick={() => move(status)}
                className={status === "rejected" ? btnGhostSm : btnSolidSm}
              >
                {status === "approved" && "Approve"}
                {status === "received" && "Mark received"}
                {status === "refunded" && "Mark refunded"}
                {status === "rejected" && "Reject"}
              </button>
            ))}
          </div>
        </div>
      )}

      {request.resolutionNote && moves.length === 0 && (
        <p className="mt-3 border-l-2 border-subtle pl-3 text-sm leading-6 text-muted">
          {request.resolutionNote}
        </p>
      )}

      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </li>
  );
}
