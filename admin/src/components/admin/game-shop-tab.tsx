"use client";

import { useRef, useState } from "react";
import { adminApi, gameShopApi } from "@/lib/api";
import type {
  GamePurchase,
  GameShopItem,
  PurchaseStatus,
  ShopItemStatus,
} from "@/lib/api/game-shop";
import { formatDate, shortId } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { imageUrl } from "@/lib/image";
import { AsteriskMark } from "../asterisk-mark";
import {
  Badge,
  btnGhost,
  btnPrimarySm,
  btnSecondarySm,
  Empty,
  ErrorNote,
  Field,
  inputCls,
  labelCls,
  Loading,
  Note,
  Panel,
  selectCls,
  tableCls,
  TableScroll,
  tdCls,
  textareaCls,
  theadCls,
  thCls,
  trCls,
  type Tone,
} from "../ui";

/**
 * The game's coin shop: what the season sells for the coins it mints.
 *
 * Two lists on one page — the items, and who bought them — because the
 * question an admin has is always both: "what is on sale" and "what do I
 * have to hand over". Items are never deleted; an archived one keeps the
 * purchases that point at it meaningful.
 */

/** Strings because they come from inputs; empty means "unlimited" for limits. */
const EMPTY = {
  name: "",
  description: "",
  imageUrl: "",
  priceCoins: "",
  stock: "",
  perPersonLimit: "",
  sortOrder: "0",
};

const STATUS_LABEL: Record<ShopItemStatus, string> = {
  draft: "Draft",
  live: "Live",
  archived: "Archived",
};

const STATUS_TONE: Record<ShopItemStatus, Tone> = {
  draft: "caution",
  live: "positive",
  archived: "neutral",
};

/** The image well doubles as a button, so it borrows the secondary look. */
const imageDropCls =
  "inline-flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] border border-line-strong bg-card text-[11px] font-semibold uppercase tracking-[0.08em] text-ink text-center transition-colors hover:border-ink";

const PURCHASE_TONE: Record<PurchaseStatus, Tone> = {
  paid: "caution",
  fulfilled: "positive",
  cancelled: "neutral",
};

export function GameShopTab() {
  return (
    <div className="flex flex-col gap-5">
      <Items />
      <Purchases />
    </div>
  );
}

function Items() {
  const { data, loading, error, reload } = useAsync(
    () => gameShopApi.listItems(),
    [],
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const items = data?.items ?? [];

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  function startEdit(item: GameShopItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? "",
      imageUrl: item.imageUrl ?? "",
      priceCoins: String(item.priceCoins),
      stock: item.stock === null ? "" : String(item.stock),
      perPersonLimit:
        item.perPersonLimit === null ? "" : String(item.perPersonLimit),
      sortOrder: String(item.sortOrder),
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setNote(null);
    try {
      const { url } = await adminApi.uploadImage(files[0]);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  /** An empty limit field means unlimited: omitted on create, null on edit. */
  function limit(value: string): number | undefined {
    return value.trim() === "" ? undefined : Number(value);
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      if (editingId) {
        await gameShopApi.updateItem(editingId, {
          name: form.name,
          description: form.description.trim() || null,
          imageUrl: form.imageUrl.trim() || null,
          priceCoins: Number(form.priceCoins),
          stock: limit(form.stock) ?? null,
          perPersonLimit: limit(form.perPersonLimit) ?? null,
          sortOrder: Number(form.sortOrder) || 0,
        });
        setNote("Item updated.");
      } else {
        await gameShopApi.createItem({
          name: form.name,
          description: form.description.trim() || undefined,
          imageUrl: form.imageUrl.trim() || undefined,
          priceCoins: Number(form.priceCoins),
          stock: limit(form.stock),
          perPersonLimit: limit(form.perPersonLimit),
          sortOrder: Number(form.sortOrder) || 0,
        });
        setNote("Item created as a draft. Set it live when it is ready.");
      }
      closeForm();
      reload();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(item: GameShopItem, status: ShopItemStatus) {
    setNote(null);
    try {
      await gameShopApi.updateItem(item.id, { status });
      reload();
    } catch (err) {
      setNote(errorMessage(err));
    }
  }

  return (
    <>
      {showForm && (
        <Panel
          eyebrow={editingId ? "Editing" : "New"}
          title={editingId ? form.name || "Item" : "New item"}
        >
          <form onSubmit={save} className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field id="gs-name" label="Name">
                <input
                  id="gs-name"
                  required
                  minLength={2}
                  maxLength={80}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field id="gs-price" label="Price (coins)">
                <input
                  id="gs-price"
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={form.priceCoins}
                  onChange={(e) =>
                    setForm({ ...form, priceCoins: e.target.value })
                  }
                  className={`${inputCls} tnum`}
                />
              </Field>
              <Field id="gs-stock" label="Stock">
                <input
                  id="gs-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  placeholder="unlimited"
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className={`${inputCls} tnum`}
                />
              </Field>
              <Field id="gs-limit" label="Per person">
                <input
                  id="gs-limit"
                  type="number"
                  min="1"
                  step="1"
                  value={form.perPersonLimit}
                  placeholder="unlimited"
                  onChange={(e) =>
                    setForm({ ...form, perPersonLimit: e.target.value })
                  }
                  className={`${inputCls} tnum`}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field id="gs-description" label="Description">
                <textarea
                  id="gs-description"
                  rows={2}
                  maxLength={2000}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className={textareaCls}
                />
              </Field>
              <Field id="gs-sort" label="Sort order">
                <input
                  id="gs-sort"
                  type="number"
                  step="1"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: e.target.value })
                  }
                  className={`${inputCls} tnum`}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className={labelCls}>Image</p>
              <div className="flex flex-wrap items-start gap-3">
                {form.imageUrl && (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl(form.imageUrl, 160)}
                      alt={form.name || "Item image"}
                      loading="lazy"
                      decoding="async"
                      className="size-20 rounded-[var(--radius-control)] bg-raised object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                      className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-[var(--radius-control)] bg-ink text-[10px] font-bold text-card"
                    >
                      ×
                    </button>
                  </div>
                )}
                <label className={imageDropCls}>
                  {uploading ? "…" : form.imageUrl ? "Replace" : "+ Add"}
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => upload(e.target.files)}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={busy || uploading}
                className={btnPrimarySm}
              >
                {busy ? "Saving…" : editingId ? "Save changes" : "Create item"}
              </button>
              <button type="button" onClick={closeForm} className={btnGhost}>
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}

      <Panel
        eyebrow="Coin shop"
        title="Items"
        aside={
          <>
            <span className="tnum text-[11px] text-faint">
              {items.length} listed ·{" "}
              {items.filter((i) => i.status === "live").length} live
            </span>
            <button
              type="button"
              onClick={() => (showForm ? closeForm() : startCreate())}
              className={btnPrimarySm}
            >
              {showForm ? "Close form" : "+ New item"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Note>{note}</Note>

          {loading && <Loading label="Loading items" />}
          {error && <ErrorNote message={error} />}
          {data && items.length === 0 && !loading && (
            <Empty>
              Nothing on sale yet — hit “+ New item” to list the first one.
            </Empty>
          )}

          {items.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col rounded-[var(--radius-control)] border border-line"
                >
                  <div className="relative p-3 pb-0">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl(item.imageUrl, 400)}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        className="aspect-square w-full rounded-[var(--radius-control)] bg-raised object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-[var(--radius-control)] bg-raised">
                        <AsteriskMark className="size-8 text-line-strong" />
                      </div>
                    )}
                    <span className="absolute left-5 top-5 flex flex-wrap gap-1.5">
                      {item.status !== "live" && (
                        <Badge tone={STATUS_TONE[item.status]}>
                          {STATUS_LABEL[item.status]}
                        </Badge>
                      )}
                      {item.status === "live" && item.stock === 0 && (
                        <Badge tone="danger">Sold out</Badge>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {item.name}
                    </p>
                    <p className="tnum text-[11px] leading-5 text-faint">
                      {item.priceCoins} coins ·{" "}
                      {item.stock === null ? "unlimited" : `stock ${item.stock}`}
                      {item.perPersonLimit !== null &&
                        ` · ${item.perPersonLimit}/person`}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1.5 pt-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className={btnGhost}
                      >
                        Edit
                      </button>
                      {item.status !== "live" && (
                        <button
                          type="button"
                          onClick={() => setStatus(item, "live")}
                          className={btnGhost}
                        >
                          Set live
                        </button>
                      )}
                      {item.status === "live" && (
                        <button
                          type="button"
                          onClick={() => setStatus(item, "draft")}
                          className={btnGhost}
                        >
                          Back to draft
                        </button>
                      )}
                      {item.status !== "archived" && (
                        <button
                          type="button"
                          onClick={() => setStatus(item, "archived")}
                          className={btnGhost}
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </>
  );
}

const PURCHASE_FILTERS: { value: PurchaseStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "paid", label: "To hand over" },
  { value: "fulfilled", label: "Handed over" },
  { value: "cancelled", label: "Cancelled" },
];

function Purchases() {
  const [status, setStatus] = useState<PurchaseStatus | "">("paid");
  const { data, loading, error, reload } = useAsync(
    () =>
      gameShopApi.listPurchases({
        status: status || undefined,
        limit: 200,
      }),
    [status],
  );
  const [note, setNote] = useState<string | null>(null);

  const purchases = data?.purchases ?? [];

  async function act(action: () => Promise<unknown>, done: string) {
    setNote(null);
    try {
      await action();
      setNote(done);
      reload();
    } catch (err) {
      setNote(errorMessage(err));
    }
  }

  return (
    <Panel
      bleed
      eyebrow="Coin shop"
      title="Purchases"
      aside={
        <label className="flex items-center gap-2">
          <span className={labelCls}>Show</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PurchaseStatus | "")}
            className={selectCls}
            aria-label="Filter purchases by status"
          >
            {PURCHASE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="flex flex-col gap-2 px-5 pb-4">
        <p className="max-w-prose text-[13px] leading-6 text-muted">
          Coins were taken the moment someone bought. “Handed over” records that
          they got the thing; “Cancel and refund” gives the coins back and puts
          the stock back.
        </p>
        <Note>{note}</Note>
      </div>

      {loading && (
        <div className="px-5">
          <Loading label="Loading purchases" />
        </div>
      )}
      {error && (
        <div className="px-5">
          <ErrorNote message={error} />
        </div>
      )}
      {data && purchases.length === 0 && !loading && <Empty>Nothing here.</Empty>}

      {purchases.length > 0 && (
        <TableScroll>
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={thCls}>Item</th>
                <th className={thCls}>Buyer</th>
                <th className={thCls}>Coins</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Bought</th>
                <th className={thCls}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <PurchaseRow key={purchase.id} purchase={purchase} act={act} />
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </Panel>
  );
}

function PurchaseRow({
  purchase,
  act,
}: {
  purchase: GamePurchase;
  act: (action: () => Promise<unknown>, done: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await act(action, done);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <>
      <tr className={trCls}>
        <td className={tdCls}>
          <p className="font-semibold text-ink">{purchase.itemName}</p>
          {purchase.note && (
            <p className="mt-0.5 max-w-xs text-[11px] leading-5 text-faint">
              {purchase.note}
            </p>
          )}
        </td>
        <td className={`${tdCls} text-muted`}>
          {purchase.enrolment?.handle ?? shortId(purchase.userId)}
        </td>
        <td className={`${tdCls} tnum`}>{purchase.priceCoins}</td>
        <td className={tdCls}>
          <Badge tone={PURCHASE_TONE[purchase.status]}>
            {purchase.status === "paid" ? "To hand over" : purchase.status}
          </Badge>
        </td>
        <td className={`${tdCls} tnum whitespace-nowrap text-faint`}>
          {formatDate(purchase.createdAt)}
          <span className="ml-2">#{shortId(purchase.id)}</span>
        </td>
        <td className={`${tdCls} text-right`}>
          {purchase.status === "paid" && !confirming && (
            <span className="inline-flex flex-wrap justify-end gap-x-3 gap-y-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => gameShopApi.setPurchaseStatus(purchase.id, "fulfilled"),
                    "Marked as handed over.",
                  )
                }
                className={btnGhost}
              >
                {busy ? "Saving…" : "Mark handed over"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(true)}
                className={`${btnGhost} text-danger hover:text-danger`}
              >
                Cancel and refund
              </button>
            </span>
          )}
        </td>
      </tr>
      {purchase.status === "paid" && confirming && (
        <tr className="border-t border-line">
          <td colSpan={6} className="px-5 py-3">
            <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-line bg-raised p-3 sm:flex-row sm:items-end">
              <Field id={`gp-reason-${purchase.id}`} label="Reason (optional)">
                <input
                  id={`gp-reason-${purchase.id}`}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Out of stock, bought by mistake…"
                  className={`${inputCls} sm:w-72`}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        gameShopApi.setPurchaseStatus(
                          purchase.id,
                          "cancelled",
                          reason.trim() || undefined,
                        ),
                      `Cancelled — ${purchase.priceCoins} coins refunded.`,
                    )
                  }
                  className={btnSecondarySm}
                >
                  {busy
                    ? "Refunding…"
                    : `Yes, refund ${purchase.priceCoins} coins`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className={btnGhost}
                >
                  Keep it
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
