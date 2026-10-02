"use client";

import { useState, type FormEvent } from "react";
import { gameApi } from "@/lib/api";
import type {
  GameOpalOrder,
  GameOpalPack,
  OpalOrderStatus,
  OpalPackStatus,
  UpdateOpalPackInput,
} from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  btnGhost,
  btnPrimary,
  btnPrimarySm,
  btnSecondary,
  cardCls,
  chipCls,
  ErrorNote,
  eyebrow,
  Field,
  inputCls,
  Loading,
  Panel,
  selectCls,
  tableCls,
  TableScroll,
  tdCls,
  theadCls,
  thCls,
  trCls,
} from "../ui";
import {
  ConfirmButton,
  Empty,
  Note,
  Pill,
  Stat,
  formatDateTime,
  shortId,
  useAction,
  type Tone,
} from "./game-ui";

const PACK_TONE: Record<OpalPackStatus, Tone> = {
  live: "positive",
  draft: "caution",
  archived: "neutral",
};

const ORDER_TONE: Record<OpalOrderStatus, Tone> = {
  paid: "positive",
  pending: "caution",
  failed: "neutral",
};

type PackFilter = OpalPackStatus | "all";
type OrderFilter = OpalOrderStatus | "all";

const PACK_FILTERS: { value: PackFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
];

const ORDER_FILTERS: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

const ORDER_LIMIT = 200;

/** Tetri to "5.00 GEL". */
function gel(cents: number): string {
  return `${(cents / 100).toFixed(2)} GEL`;
}

/**
 * Opal packs: the price list players buy opals from, and the orders.
 *
 * Nothing is on sale until a pack is published. Packs can be repriced at
 * any time — an order snapshots the name, opals and price it was bought
 * at, so an edit only changes what is sold from now on. Archiving takes a
 * pack off sale without touching its orders.
 *
 * Opals land on the buyer's season balance like earned coins, and carry
 * to the next season unspent. Test-mode orders are marked: they moved no
 * money and are left out of the revenue figure.
 */
export function OpalsTab() {
  const packs = useAsync(() => gameApi.listOpalPacks(), []);
  const [packFilter, setPackFilter] = useState<PackFilter>("all");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const orders = useAsync(
    () =>
      gameApi.listOpalOrders({
        status: orderFilter === "all" ? undefined : orderFilter,
        limit: ORDER_LIMIT,
      }),
    [orderFilter],
  );
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const packsAction = useAction(packs.reload);

  if (!packs.data) {
    if (packs.error) return <ErrorNote message={packs.error} />;
    return <Loading label="Loading opal packs" />;
  }

  const allPacks = packs.data.packs;
  const visible =
    packFilter === "all"
      ? allPacks
      : allPacks.filter((p) => p.status === packFilter);
  const countOf = (filter: PackFilter) =>
    filter === "all"
      ? allPacks.length
      : allPacks.filter((p) => p.status === filter).length;

  const loadedOrders = orders.data?.orders ?? [];
  const realPaid = loadedOrders.filter((o) => o.status === "paid" && !o.testMode);
  const revenue = realPaid.reduce((sum, o) => sum + o.priceCents, 0);
  const opalsSold = realPaid.reduce((sum, o) => sum + o.opals, 0);

  async function create(values: NormalisedPack): Promise<boolean> {
    let created = false;
    await packsAction.act(
      () =>
        gameApi.createOpalPack({
          ...values,
          badge: values.badge ?? undefined,
        }),
      (r) => {
        created = true;
        const pack = r as GameOpalPack;
        return pack.status === "live"
          ? `“${pack.name}” is on sale now.`
          : `“${pack.name}” saved as a draft. Publish it when it is ready.`;
      },
    );
    return created;
  }

  async function save(pack: GameOpalPack, values: NormalisedPack): Promise<boolean> {
    const patch = diff(values, pack);
    if (Object.keys(patch).length === 0) {
      packsAction.setNote("Nothing changed.");
      return false;
    }
    let saved = false;
    await packsAction.act(
      () => gameApi.updateOpalPack(pack.id, patch),
      () => {
        saved = true;
        return `“${values.name}” updated.`;
      },
    );
    return saved;
  }

  function setStatus(pack: GameOpalPack, status: OpalPackStatus) {
    const done =
      status === "live"
        ? `“${pack.name}” is on sale.`
        : status === "archived"
          ? `“${pack.name}” is archived. Nobody can buy it.`
          : `“${pack.name}” is back in draft.`;
    return packsAction.act(() => gameApi.updateOpalPack(pack.id, { status }), done);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}>
        <div className="p-5">
          <Stat label="Live packs" value={countOf("live")} hint="on sale now" />
        </div>
        <div className="p-5">
          <Stat
            label="Paid orders"
            value={orders.data ? realPaid.length : "…"}
            hint="real money, test mode excluded"
          />
        </div>
        <div className="p-5">
          <Stat
            label="Revenue"
            value={orders.data ? gel(revenue) : "…"}
            hint={`over the ${loadedOrders.length} orders loaded`}
          />
        </div>
        <div className="p-5">
          <Stat
            label="Opals sold"
            value={orders.data ? opalsSold : "…"}
            hint="credited to balances"
          />
        </div>
      </div>

      {/* -------------------------------------------------------- packs -- */}
      <Panel
        title="Packs"
        aside={
          <button
            type="button"
            onClick={() => setCreating((open) => !open)}
            aria-expanded={creating}
            className={btnPrimarySm}
          >
            {creating ? "Close form" : "New pack"}
          </button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="max-w-2xl text-[12px] leading-6 text-muted">
            Only live packs are on sale. A new pack lands as a draft unless you
            say otherwise. Repricing never changes past orders. Players pay by
            card; until an acquirer is configured, card payment shows as coming
            soon (or settles instantly in test mode).
          </p>

          {creating && (
            <div className="rounded-[var(--radius-control)] border border-line bg-raised p-4 sm:p-5">
              <p className={`${eyebrow} mb-4`}>New pack</p>
              <PackForm
                idPrefix="new-pack"
                busy={packsAction.busy}
                submitLabel="Create pack"
                onSave={create}
                onCancel={() => setCreating(false)}
                onSaved={() => setCreating(false)}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {PACK_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={packFilter === filter.value}
                onClick={() => setPackFilter(filter.value)}
                className={chipCls(packFilter === filter.value)}
              >
                {filter.label} {countOf(filter.value)}
              </button>
            ))}
          </div>
          <Note>{packsAction.note}</Note>

          {visible.length === 0 ? (
            <Empty>
              {allPacks.length === 0
                ? "No packs yet. Add the first one above; it lands as a draft until you publish it."
                : `No ${packFilter === "all" ? "" : packFilter + " "}packs.`}
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((pack) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  busy={packsAction.busy}
                  editing={editingId === pack.id}
                  onToggleEdit={() =>
                    setEditingId((current) => (current === pack.id ? null : pack.id))
                  }
                  onStatus={(status) => setStatus(pack, status)}
                  onSave={(values) => save(pack, values)}
                  onSaved={() => setEditingId(null)}
                />
              ))}
            </div>
          )}
        </div>
      </Panel>

      {/* ------------------------------------------------------- orders -- */}
      <Panel
        title="Orders"
        aside={
          <span className="text-[11px] text-faint">
            newest first · latest {ORDER_LIMIT}
          </span>
        }
        bleed
      >
        <div className="flex flex-col gap-4 px-5 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {ORDER_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={orderFilter === filter.value}
                onClick={() => setOrderFilter(filter.value)}
                className={chipCls(orderFilter === filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {orders.error && (
          <div className="px-5 pb-5">
            <ErrorNote message={orders.error} />
          </div>
        )}
        {orders.loading && !orders.data && (
          <div className="px-5 pb-5">
            <Loading label="Loading orders" />
          </div>
        )}
        {orders.data && loadedOrders.length === 0 && (
          <Empty>
            {orderFilter === "all" ? "Nobody has bought opals yet." : "No orders match."}
          </Empty>
        )}
        {loadedOrders.length > 0 && (
          <TableScroll>
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr className="border-t border-line">
                  <th scope="col" className={thCls}>Buyer</th>
                  <th scope="col" className={thCls}>Pack</th>
                  <th scope="col" className={thCls}>Opals</th>
                  <th scope="col" className={thCls}>Price</th>
                  <th scope="col" className={thCls}>Method</th>
                  <th scope="col" className={thCls}>Status</th>
                  <th scope="col" className={thCls}>When</th>
                </tr>
              </thead>
              <tbody>
                {loadedOrders.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------ pack card --

function PackCard({
  pack,
  busy,
  editing,
  onToggleEdit,
  onStatus,
  onSave,
  onSaved,
}: {
  pack: GameOpalPack;
  busy: boolean;
  editing: boolean;
  onToggleEdit: () => void;
  onStatus: (status: OpalPackStatus) => void | Promise<void>;
  onSave: (values: NormalisedPack) => Promise<boolean>;
  onSaved: () => void;
}) {
  return (
    <article
      className={`flex flex-col gap-3 rounded-[var(--radius-control)] border border-line bg-raised p-4 ${
        editing ? "sm:col-span-2 xl:col-span-3" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold">
            {pack.name}
            {pack.badge && (
              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                {pack.badge}
              </span>
            )}
          </p>
          <p className="tnum mt-1 text-[13px] text-muted">
            {pack.opals.toLocaleString("en-US")} opals · {gel(pack.priceCents)}
          </p>
        </div>
        <Pill tone={PACK_TONE[pack.status]}>{pack.status}</Pill>
      </div>

      <p className="tnum text-[11px] leading-5 text-faint">
        {(pack.priceCents / pack.opals).toFixed(2)} tetri per opal · sort {pack.sortOrder}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-4 border-t border-line pt-3">
        <button type="button" onClick={onToggleEdit} aria-expanded={editing} className={btnGhost}>
          {editing ? "Close editor" : "Edit"}
        </button>
        {pack.status === "draft" && (
          <button type="button" disabled={busy} onClick={() => onStatus("live")} className={btnGhost}>
            Publish
          </button>
        )}
        {pack.status === "live" && (
          <ConfirmButton
            label="Archive"
            confirmLabel="Take it off sale?"
            disabled={busy}
            onConfirm={() => onStatus("archived")}
          />
        )}
        {pack.status === "archived" && (
          <button type="button" disabled={busy} onClick={() => onStatus("draft")} className={btnGhost}>
            Unarchive to draft
          </button>
        )}
      </div>

      {editing && (
        <div className="rounded-[var(--radius-control)] border border-line bg-card p-4 sm:p-5">
          <p className={`${eyebrow} mb-4`}>Editing: {pack.name}</p>
          <PackForm
            idPrefix={`pack-${pack.id}`}
            pack={pack}
            busy={busy}
            submitLabel="Save changes"
            onSave={onSave}
            onCancel={onToggleEdit}
            onSaved={onSaved}
          />
        </div>
      )}
    </article>
  );
}

// ------------------------------------------------------------ order row --

function OrderRow({ order }: { order: GameOpalOrder }) {
  return (
    <tr className={trCls}>
      <td className={`${tdCls} font-mono text-[12px]`}>{shortId(order.userId)}</td>
      <td className={tdCls}>{order.packName}</td>
      <td className={`${tdCls} tnum`}>{order.opals.toLocaleString("en-US")}</td>
      <td className={`${tdCls} tnum whitespace-nowrap`}>{gel(order.priceCents)}</td>
      <td className={`${tdCls} whitespace-nowrap text-[12px]`}>
        {order.paymentMethod === "card_tbc" ? "TBC card" : "BOG card"}
      </td>
      <td className={tdCls}>
        <span className="inline-flex items-center gap-2">
          <Pill tone={ORDER_TONE[order.status]}>{order.status}</Pill>
          {order.testMode && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">test</span>
          )}
        </span>
      </td>
      <td className={`${tdCls} whitespace-nowrap text-[12px] text-faint`}>
        {formatDateTime(order.paidAt ?? order.createdAt)}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------- form --

interface PackFormValues {
  name: string;
  opals: string;
  priceGel: string;
  badge: string;
  status: OpalPackStatus;
  sortOrder: string;
}

interface NormalisedPack {
  name: string;
  opals: number;
  priceCents: number;
  badge: string | null;
  status: OpalPackStatus;
  sortOrder: number;
}

const EMPTY_FORM: PackFormValues = {
  name: "",
  opals: "",
  priceGel: "",
  badge: "",
  status: "draft",
  sortOrder: "0",
};

function fromPack(pack: GameOpalPack): PackFormValues {
  return {
    name: pack.name,
    opals: String(pack.opals),
    priceGel: (pack.priceCents / 100).toFixed(2),
    badge: pack.badge ?? "",
    status: pack.status,
    sortOrder: String(pack.sortOrder),
  };
}

function validate(v: PackFormValues): string | null {
  if (v.name.trim().length < 2) return "Give the pack a name of at least two characters.";
  const opals = Number(v.opals);
  if (!Number.isInteger(opals) || opals < 1 || opals > 1_000_000) {
    return "Opals must be a whole number from 1 to 1,000,000.";
  }
  // Lari with at most two decimals — tetri are the smallest unit.
  if (!/^\d+(\.\d{1,2})?$/.test(v.priceGel.trim())) {
    return "Price must be in lari, like 5 or 4.50.";
  }
  const cents = Math.round(Number(v.priceGel) * 100);
  if (cents < 1 || cents > 1_000_000) return "Price must be between 0.01 and 10,000 GEL.";
  if (v.badge.trim().length > 24) return "Keep the badge to 24 characters.";
  const sort = Number(v.sortOrder);
  if (!Number.isInteger(sort) || sort < -1000 || sort > 1000) {
    return "Sort order must be a whole number from -1000 to 1000.";
  }
  return null;
}

function normalise(v: PackFormValues): NormalisedPack {
  return {
    name: v.name.trim(),
    opals: Number(v.opals),
    priceCents: Math.round(Number(v.priceGel) * 100),
    badge: v.badge.trim() || null,
    status: v.status,
    sortOrder: Number(v.sortOrder),
  };
}

/** Only the fields that changed, so an edit never overwrites more than it meant to. */
function diff(values: NormalisedPack, pack: GameOpalPack): UpdateOpalPackInput {
  const patch: UpdateOpalPackInput = {};
  if (values.name !== pack.name) patch.name = values.name;
  if (values.opals !== pack.opals) patch.opals = values.opals;
  if (values.priceCents !== pack.priceCents) patch.priceCents = values.priceCents;
  if (values.badge !== pack.badge) patch.badge = values.badge ?? "";
  if (values.status !== pack.status) patch.status = values.status;
  if (values.sortOrder !== pack.sortOrder) patch.sortOrder = values.sortOrder;
  return patch;
}

function PackForm({
  idPrefix,
  pack,
  busy,
  submitLabel,
  onSave,
  onCancel,
  onSaved,
}: {
  idPrefix: string;
  pack?: GameOpalPack;
  busy: boolean;
  submitLabel: string;
  onSave: (values: NormalisedPack) => Promise<boolean>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<PackFormValues>(pack ? fromPack(pack) : EMPTY_FORM);
  const [problem, setProblem] = useState<string | null>(null);
  const patch = (next: Partial<PackFormValues>) => setValues((v) => ({ ...v, ...next }));
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id={id("name")} label="Name">
          <input
            id={id("name")}
            value={values.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Handful"
            maxLength={60}
            required
            className={inputCls}
          />
        </Field>
        <Field id={id("opals")} label="Opals">
          <input
            id={id("opals")}
            type="number"
            inputMode="numeric"
            min={1}
            max={1_000_000}
            step={1}
            value={values.opals}
            onChange={(e) => patch({ opals: e.target.value })}
            placeholder="100"
            required
            className={inputCls}
          />
        </Field>
        <Field id={id("price")} label="Price (GEL)">
          <input
            id={id("price")}
            inputMode="decimal"
            value={values.priceGel}
            onChange={(e) => patch({ priceGel: e.target.value })}
            placeholder="5.00"
            required
            className={inputCls}
          />
        </Field>
        <Field id={id("badge")} label="Badge (optional)">
          <input
            id={id("badge")}
            value={values.badge}
            onChange={(e) => patch({ badge: e.target.value })}
            placeholder="BEST VALUE"
            maxLength={24}
            className={inputCls}
          />
        </Field>
        <Field id={id("status")} label="Status">
          <select
            id={id("status")}
            value={values.status}
            onChange={(e) => patch({ status: e.target.value as OpalPackStatus })}
            className={selectCls}
          >
            <option value="draft">Draft</option>
            <option value="live">Live</option>
            {pack?.status === "archived" && <option value="archived">Archived</option>}
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
            className={inputCls}
          />
        </Field>
      </div>

      {problem && <ErrorNote message={problem} />}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
