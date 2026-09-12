"use client";

import { useState, type FormEvent } from "react";
import { gameApi } from "@/lib/api";
import type {
  CreateShopItemInput,
  GamePurchase,
  GameShopItem,
  PurchaseStatus,
  ShopItemStatus,
  UpdateShopItemInput,
} from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  btnGhostSm,
  btnOutline,
  btnSolidSm,
  chipCls,
  ErrorNote,
  Field,
  inputCls,
  Loading,
  selectCls,
  textareaCls,
} from "../ui";
import {
  ConfirmButton,
  Empty,
  Note,
  Pill,
  SectionTitle,
  Stat,
  formatDateTime,
  shortId,
  useAction,
  type Tone,
} from "./game-ui";

const ITEM_TONE: Record<ShopItemStatus, Tone> = {
  live: "solid",
  draft: "neutral",
  archived: "outline",
};

// `paid` is the one that needs a person: it is waiting to be handed over.
const PURCHASE_TONE: Record<PurchaseStatus, Tone> = {
  paid: "outline",
  fulfilled: "solid",
  cancelled: "neutral",
};

type ItemFilter = ShopItemStatus | "all";
type PurchaseFilter = PurchaseStatus | "all";

const ITEM_FILTERS: { value: ItemFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
];

const PURCHASE_FILTERS: { value: PurchaseFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
];

const PURCHASE_LIMIT = 200;

/**
 * The coin shop: what is on sale, and who bought what.
 *
 * Items are loaded once and filtered here — there are at most a few hundred,
 * the item filter for purchases needs the whole list anyway, and one list
 * means the counts on the chips are always right.
 */
export function ShopTab() {
  const items = useAsync(() => gameApi.listShopItems(), []);
  const [itemFilter, setItemFilter] = useState<ItemFilter>("all");
  const [purchaseFilter, setPurchaseFilter] = useState<PurchaseFilter>("all");
  const [purchaseItemId, setPurchaseItemId] = useState("");
  const purchases = useAsync(
    () =>
      gameApi.listPurchases({
        status: purchaseFilter === "all" ? undefined : purchaseFilter,
        itemId: purchaseItemId || undefined,
        limit: PURCHASE_LIMIT,
      }),
    [purchaseFilter, purchaseItemId],
  );
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const itemsAction = useAction(items.reload);
  // A refund puts the stock back on the item, so a purchase action refreshes
  // both lists rather than leaving a stale "n left" above.
  const purchasesAction = useAction(() => {
    items.reload();
    purchases.reload();
  });

  if (!items.data) {
    if (items.error) return <ErrorNote message={items.error} />;
    return <Loading label="Loading the shop" />;
  }

  const allItems = items.data.items;
  const visibleItems =
    itemFilter === "all"
      ? allItems
      : allItems.filter((item) => item.status === itemFilter);
  const countOf = (filter: ItemFilter) =>
    filter === "all"
      ? allItems.length
      : allItems.filter((item) => item.status === filter).length;

  const loadedPurchases = purchases.data?.purchases ?? [];
  const waiting = loadedPurchases.filter((p) => p.status === "paid").length;
  const fulfilled = loadedPurchases.filter(
    (p) => p.status === "fulfilled",
  ).length;
  const coinsSpent = loadedPurchases.reduce(
    (sum, p) => (p.status === "cancelled" ? sum : sum + p.priceCoins),
    0,
  );

  async function createItem(values: NormalisedItem): Promise<boolean> {
    // `act` swallows failures into the note; `done` only runs on success,
    // so it is the signal the form uses to clear itself.
    let created = false;
    await itemsAction.act(
      () => gameApi.createShopItem(toCreateInput(values)),
      (r) => {
        created = true;
        const item = r as GameShopItem;
        return item.status === "live"
          ? `“${item.name}” is on sale now.`
          : `“${item.name}” saved as a draft. Publish it when it is ready.`;
      },
    );
    return created;
  }

  async function saveItem(
    item: GameShopItem,
    values: NormalisedItem,
  ): Promise<boolean> {
    const patch = toUpdateInput(values, item);
    if (Object.keys(patch).length === 0) {
      itemsAction.setNote("Nothing changed.");
      return false;
    }
    let saved = false;
    await itemsAction.act(
      () => gameApi.updateShopItem(item.id, patch),
      () => {
        saved = true;
        return `“${values.name}” updated.`;
      },
    );
    return saved;
  }

  function setItemStatus(item: GameShopItem, status: ShopItemStatus) {
    const done =
      status === "live"
        ? `“${item.name}” is on sale.`
        : status === "archived"
          ? `“${item.name}” is archived. Nobody can buy it.`
          : `“${item.name}” is back in draft.`;
    return itemsAction.act(
      () => gameApi.updateShopItem(item.id, { status }),
      done,
    );
  }

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Live items" value={countOf("live")} hint="on sale now" />
        <Stat
          label="Waiting"
          value={purchases.data ? waiting : "…"}
          hint="paid, not yet handed over"
        />
        <Stat
          label="Fulfilled"
          value={purchases.data ? fulfilled : "…"}
          hint="handed over"
        />
        <Stat
          label="Coins spent"
          value={purchases.data ? coinsSpent : "…"}
          hint={`over the ${loadedPurchases.length} purchases loaded, refunds excluded`}
        />
      </div>

      {/* ------------------------------------------------------- items -- */}
      <section>
        <SectionTitle
          aside={
            <button
              type="button"
              onClick={() => setCreating((open) => !open)}
              aria-expanded={creating}
              className={btnSolidSm}
            >
              {creating ? "Close form" : "+ New item"}
            </button>
          }
        >
          Items
        </SectionTitle>
        <p className="mb-4 max-w-2xl text-xs leading-6 text-muted">
          Only live items are on sale. A new item lands as a draft unless you
          say otherwise; archiving takes it off sale without touching the
          purchases already made. Stock left blank is unlimited.
        </p>

        {creating && (
          <div className="mb-6 border border-subtle p-4 sm:p-6">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              New item
            </p>
            <ItemForm
              idPrefix="new-item"
              busy={itemsAction.busy}
              submitLabel="Create item"
              onSave={createItem}
              onCancel={() => setCreating(false)}
              onSaved={() => setCreating(false)}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {ITEM_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={itemFilter === filter.value}
              onClick={() => setItemFilter(filter.value)}
              className={chipCls(itemFilter === filter.value)}
            >
              {filter.label} {countOf(filter.value)}
            </button>
          ))}
        </div>
        <Note>{itemsAction.note}</Note>

        {visibleItems.length === 0 ? (
          <Empty>
            {allItems.length === 0
              ? "Nothing listed yet. Add the first item above; it lands as a draft until you publish it."
              : `No ${itemFilter === "all" ? "" : itemFilter + " "}items.`}
          </Empty>
        ) : (
          <ul className="mt-4 border-t border-subtle">
            {visibleItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                busy={itemsAction.busy}
                editing={editingId === item.id}
                onToggleEdit={() =>
                  setEditingId((current) =>
                    current === item.id ? null : item.id,
                  )
                }
                onStatus={(status) => setItemStatus(item, status)}
                onSave={(values) => saveItem(item, values)}
                onSaved={() => setEditingId(null)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* --------------------------------------------------- purchases -- */}
      <section>
        <SectionTitle
          aside={
            <span className="text-xs text-muted">
              newest first · latest {PURCHASE_LIMIT}
            </span>
          }
        >
          Purchases
        </SectionTitle>
        <p className="mb-4 max-w-2xl text-xs leading-6 text-muted">
          A paid purchase is waiting to be handed over; mark it fulfilled once
          it has been. Cancelling returns the coins to the player and the stock
          to the item, and a cancelled purchase cannot be changed again.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {PURCHASE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={purchaseFilter === filter.value}
              onClick={() => setPurchaseFilter(filter.value)}
              className={chipCls(purchaseFilter === filter.value)}
            >
              {filter.label}
            </button>
          ))}
          <select
            aria-label="Filter purchases by item"
            value={purchaseItemId}
            onChange={(e) => setPurchaseItemId(e.target.value)}
            className={`${selectCls} h-9`}
          >
            <option value="">All items</option>
            {allItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <Note>{purchasesAction.note}</Note>

        {purchases.error && <ErrorNote message={purchases.error} />}
        {purchases.loading && !purchases.data && (
          <Loading label="Loading purchases" />
        )}
        {purchases.data && loadedPurchases.length === 0 && (
          <Empty>
            {purchaseFilter === "all" && !purchaseItemId
              ? "Nobody has bought anything yet."
              : "No purchases match."}
          </Empty>
        )}
        {loadedPurchases.length > 0 && (
          <ul className="mt-4 border-t border-subtle">
            {loadedPurchases.map((purchase) => (
              <PurchaseRow
                key={purchase.id}
                purchase={purchase}
                busy={purchasesAction.busy}
                onStatus={(status, note) =>
                  purchasesAction.act(
                    () =>
                      gameApi.setPurchaseStatus(purchase.id, {
                        status,
                        note: note.trim() || undefined,
                      }),
                    status === "fulfilled"
                      ? `${who(purchase)}’s ${purchase.itemName} is marked handed over.`
                      : `${who(purchase)} has ${purchase.priceCoins} coins back and the ${purchase.itemName} is back in stock.`,
                  )
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------- item row --

function ItemRow({
  item,
  busy,
  editing,
  onToggleEdit,
  onStatus,
  onSave,
  onSaved,
}: {
  item: GameShopItem;
  busy: boolean;
  editing: boolean;
  onToggleEdit: () => void;
  onStatus: (status: ShopItemStatus) => void | Promise<void>;
  onSave: (values: NormalisedItem) => Promise<boolean>;
  onSaved: () => void;
}) {
  return (
    <li className="border-b border-subtle py-4">
      <div className="flex gap-4">
        <Thumb item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-bold uppercase tracking-wide">
                {item.name}
              </span>
              <span className="text-xs tabular-nums text-muted">
                {item.priceCoins} coins
              </span>
            </p>
            <span className="flex flex-wrap items-center gap-2">
              <Pill tone={ITEM_TONE[item.status]}>{item.status}</Pill>
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                {stockWords(item.stock)} · {limitWords(item.perPersonLimit)} ·
                sort {item.sortOrder}
              </span>
            </span>
          </div>
          {item.description && (
            <p className="mt-1 line-clamp-2 max-w-2xl text-xs leading-5 text-muted">
              {item.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onToggleEdit}
              aria-expanded={editing}
              className={btnGhostSm}
            >
              {editing ? "Close editor" : "Edit"}
            </button>
            {item.status === "draft" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatus("live")}
                className={btnGhostSm}
              >
                Publish
              </button>
            )}
            {item.status === "live" && (
              <ConfirmButton
                label="Archive"
                confirmLabel="Take it off sale?"
                disabled={busy}
                onConfirm={() => onStatus("archived")}
              />
            )}
            {item.status === "archived" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatus("draft")}
                className={btnGhostSm}
              >
                Unarchive to draft
              </button>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <div className="mt-4 border border-subtle p-4 sm:p-6">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Editing: {item.name}
          </p>
          <ItemForm
            idPrefix={`item-${item.id}`}
            item={item}
            busy={busy}
            submitLabel="Save changes"
            onSave={onSave}
            onCancel={onToggleEdit}
            onSaved={onSaved}
          />
        </div>
      )}
    </li>
  );
}

function Thumb({ item }: { item: GameShopItem }) {
  if (!item.imageUrl) {
    return (
      <div
        aria-hidden
        className="size-16 shrink-0 rounded-[2px] border border-subtle bg-surface"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an admin-typed external URL, not a next/image host
    <img
      src={item.imageUrl}
      alt=""
      className="size-16 shrink-0 rounded-[2px] border border-subtle object-cover"
    />
  );
}

function stockWords(stock: number | null): string {
  return stock === null ? "unlimited" : `${stock} left`;
}

function limitWords(limit: number | null): string {
  return limit === null ? "no limit" : `${limit} per person`;
}

// --------------------------------------------------------- purchase row --

function PurchaseRow({
  purchase,
  busy,
  onStatus,
}: {
  purchase: GamePurchase;
  busy: boolean;
  onStatus: (
    status: "fulfilled" | "cancelled",
    note: string,
  ) => void | Promise<void>;
}) {
  const [note, setNote] = useState("");
  const handle = who(purchase);
  return (
    <li className="border-b border-subtle py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-bold uppercase tracking-wide">
            {handle}
          </span>
          <span className="text-xs text-muted">{purchase.itemName}</span>
          <span className="text-xs tabular-nums text-muted">
            {purchase.priceCoins} coins
          </span>
        </p>
        <span className="flex flex-wrap items-center gap-2">
          <Pill tone={PURCHASE_TONE[purchase.status]}>{purchase.status}</Pill>
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
            {formatDateTime(purchase.createdAt)}
          </span>
        </span>
      </div>
      {purchase.note && (
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
          {purchase.note}
        </p>
      )}

      {purchase.status === "paid" && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <input
            aria-label={`Note on ${handle}’s ${purchase.itemName}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={500}
            className={`${inputCls} h-10 max-w-xs`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus("fulfilled", note)}
            className={btnGhostSm}
          >
            Mark fulfilled
          </button>
          <ConfirmButton
            label="Cancel & refund"
            confirmLabel="Refund the coins and restock?"
            disabled={busy}
            onConfirm={() => onStatus("cancelled", note)}
          />
        </div>
      )}
    </li>
  );
}

/** The admin listing joins the enrolment; fall back to the id if it did not. */
function who(purchase: GamePurchase): string {
  return purchase.enrolment?.handle ?? shortId(purchase.enrolmentId);
}

// ---------------------------------------------------------------- form --

/** Strings because they come from inputs; blank means "not set". */
interface ItemFormValues {
  name: string;
  description: string;
  imageUrl: string;
  priceCoins: string;
  stock: string;
  perPersonLimit: string;
  status: ShopItemStatus;
  sortOrder: string;
}

/** The form after validation, in the shapes the backend stores. */
interface NormalisedItem {
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCoins: number;
  stock: number | null;
  perPersonLimit: number | null;
  status: ShopItemStatus;
  sortOrder: number;
}

const EMPTY_FORM: ItemFormValues = {
  name: "",
  description: "",
  imageUrl: "",
  priceCoins: "",
  stock: "",
  perPersonLimit: "",
  status: "draft",
  sortOrder: "0",
};

function fromItem(item: GameShopItem): ItemFormValues {
  return {
    name: item.name,
    description: item.description ?? "",
    imageUrl: item.imageUrl ?? "",
    priceCoins: String(item.priceCoins),
    stock: item.stock === null ? "" : String(item.stock),
    perPersonLimit:
      item.perPersonLimit === null ? "" : String(item.perPersonLimit),
    status: item.status,
    sortOrder: String(item.sortOrder),
  };
}

function ItemForm({
  idPrefix,
  item,
  busy,
  submitLabel,
  onSave,
  onCancel,
  onSaved,
}: {
  idPrefix: string;
  /** Present when editing; the fields start from it. */
  item?: GameShopItem;
  busy: boolean;
  submitLabel: string;
  /** Resolves true when the server took it, so the form knows to reset. */
  onSave: (values: NormalisedItem) => Promise<boolean>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<ItemFormValues>(
    item ? fromItem(item) : EMPTY_FORM,
  );
  const [problem, setProblem] = useState<string | null>(null);
  const patch = (next: Partial<ItemFormValues>) =>
    setValues((v) => ({ ...v, ...next }));
  const id = (field: string) => `${idPrefix}-${field}`;

  function submit(e: FormEvent) {
    e.preventDefault();
    const fault = validate(values);
    setProblem(fault);
    if (fault) return;
    void onSave(normalise(values)).then((saved) => {
      if (!saved) return;
      setValues(EMPTY_FORM);
      onSaved();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id={id("name")} label="Name">
          <input
            id={id("name")}
            value={values.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Sticker pack"
            minLength={2}
            maxLength={80}
            required
            className={inputCls}
          />
        </Field>
        <Field id={id("price")} label="Price (coins)">
          <input
            id={id("price")}
            type="number"
            inputMode="numeric"
            min={0}
            max={1_000_000}
            step={1}
            value={values.priceCoins}
            onChange={(e) => patch({ priceCoins: e.target.value })}
            placeholder="120"
            required
            className={inputCls}
          />
        </Field>
        <Field id={id("stock")} label="Stock">
          <input
            id={id("stock")}
            type="number"
            inputMode="numeric"
            min={0}
            max={1_000_000}
            step={1}
            value={values.stock}
            onChange={(e) => patch({ stock: e.target.value })}
            placeholder="blank = unlimited"
            className={inputCls}
          />
        </Field>
        <Field id={id("limit")} label="Per-person limit">
          <input
            id={id("limit")}
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            step={1}
            value={values.perPersonLimit}
            onChange={(e) => patch({ perPersonLimit: e.target.value })}
            placeholder="blank = no limit"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Field id={id("image")} label="Image URL">
            <input
              id={id("image")}
              type="url"
              inputMode="url"
              value={values.imageUrl}
              onChange={(e) => patch({ imageUrl: e.target.value })}
              placeholder="https://media.stiff.ge/…"
              maxLength={600}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={inputCls}
            />
          </Field>
        </div>
        <Field id={id("status")} label="Status">
          <select
            id={id("status")}
            value={values.status}
            onChange={(e) =>
              patch({ status: e.target.value as ShopItemStatus })
            }
            className={`${selectCls} h-12 w-full`}
          >
            <option value="draft">Draft</option>
            <option value="live">Live</option>
            {/* Only offered when it already is, so the row's actions stay
                the one way to archive. */}
            {item?.status === "archived" && (
              <option value="archived">Archived</option>
            )}
          </select>
        </Field>
        <Field id={id("sort")} label="Sort order">
          <input
            id={id("sort")}
            type="number"
            inputMode="numeric"
            min={-1000}
            max={1000}
            step={1}
            value={values.sortOrder}
            onChange={(e) => patch({ sortOrder: e.target.value })}
            aria-describedby={id("sort-hint")}
            className={inputCls}
          />
          <p id={id("sort-hint")} className="text-xs text-muted">
            Lower comes first in the shop.
          </p>
        </Field>
      </div>

      <Field id={id("description")} label="Description">
        <textarea
          id={id("description")}
          rows={3}
          value={values.description}
          onChange={(e) => patch({ description: e.target.value })}
          maxLength={2000}
          className={textareaCls}
        />
      </Field>

      <p aria-live="polite" className="min-h-4 text-xs text-muted">
        {problem}
      </p>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={btnSolidSm}>
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={btnOutline}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Blank is null; anything that is not a whole number is NaN. */
function whole(raw: string): number | null {
  const text = raw.trim();
  if (text === "") return null;
  const n = Number(text);
  return Number.isInteger(n) ? n : NaN;
}

function isHttpUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** The same limits as the server's DTOs, so the first error is instant. */
function validate(v: ItemFormValues): string | null {
  const name = v.name.trim();
  if (name.length < 2 || name.length > 80) {
    return "Name needs 2 to 80 characters.";
  }
  if (v.description.trim().length > 2000) {
    return "Description is capped at 2000 characters.";
  }
  const image = v.imageUrl.trim();
  if (image.length > 600) return "Image URL is capped at 600 characters.";
  if (image && !isHttpUrl(image)) {
    return "Image URL must be a full http:// or https:// address.";
  }
  const price = whole(v.priceCoins);
  if (
    price === null ||
    Number.isNaN(price) ||
    price < 0 ||
    price > 1_000_000
  ) {
    return "Price must be a whole number of coins from 0 to 1,000,000.";
  }
  const stock = whole(v.stock);
  if (
    stock !== null &&
    (Number.isNaN(stock) || stock < 0 || stock > 1_000_000)
  ) {
    return "Stock must be blank for unlimited, or a whole number from 0 to 1,000,000.";
  }
  const limit = whole(v.perPersonLimit);
  if (limit !== null && (Number.isNaN(limit) || limit < 1 || limit > 1000)) {
    return "Per-person limit must be blank for none, or a whole number from 1 to 1000.";
  }
  const sort = whole(v.sortOrder) ?? 0;
  if (Number.isNaN(sort) || sort < -1000 || sort > 1000) {
    return "Sort order must be a whole number from −1000 to 1000.";
  }
  return null;
}

/** Only call after `validate` has passed. */
function normalise(v: ItemFormValues): NormalisedItem {
  return {
    name: v.name.trim(),
    description: v.description.trim() || null,
    imageUrl: v.imageUrl.trim() || null,
    priceCoins: whole(v.priceCoins) ?? 0,
    stock: whole(v.stock),
    perPersonLimit: whole(v.perPersonLimit),
    status: v.status,
    sortOrder: whole(v.sortOrder) ?? 0,
  };
}

/**
 * Only what the admin filled in. The server defaults the rest, and an
 * `undefined` key is dropped on the wire, so the audit entry shows exactly
 * what was chosen rather than every default.
 */
function toCreateInput(n: NormalisedItem): CreateShopItemInput {
  return {
    name: n.name,
    priceCoins: n.priceCoins,
    description: n.description ?? undefined,
    imageUrl: n.imageUrl ?? undefined,
    stock: n.stock ?? undefined,
    perPersonLimit: n.perPersonLimit ?? undefined,
    status: n.status === "draft" ? undefined : n.status,
    sortOrder: n.sortOrder === 0 ? undefined : n.sortOrder,
  };
}

/** Only what changed. A field cleared to blank goes as `null` to clear it. */
function toUpdateInput(
  n: NormalisedItem,
  item: GameShopItem,
): UpdateShopItemInput {
  const patch: UpdateShopItemInput = {};
  if (n.name !== item.name) patch.name = n.name;
  if (n.description !== item.description) patch.description = n.description;
  if (n.imageUrl !== item.imageUrl) patch.imageUrl = n.imageUrl;
  if (n.priceCoins !== item.priceCoins) patch.priceCoins = n.priceCoins;
  if (n.stock !== item.stock) patch.stock = n.stock;
  if (n.perPersonLimit !== item.perPersonLimit) {
    patch.perPersonLimit = n.perPersonLimit;
  }
  if (n.status !== item.status) patch.status = n.status;
  if (n.sortOrder !== item.sortOrder) patch.sortOrder = n.sortOrder;
  return patch;
}
