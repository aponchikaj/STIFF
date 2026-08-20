"use client";

import { useCallback, useEffect, useState } from "react";
import { promotionsApi } from "@/lib/api";
import type { DiscountCode, DiscountKind, GiftCard } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import {
  btnGhostSm,
  btnSolidSm,
  chipCls,
  Field,
  inputCls,
  labelCls,
  Loading,
  selectCls,
} from "../ui";

const KINDS: { value: DiscountKind; label: string; hint: string }[] = [
  { value: "percent", label: "Percent off", hint: "1–100. Comes off goods only, never off shipping." },
  { value: "fixed", label: "Amount off", hint: "Capped at the value of the goods." },
  { value: "free_shipping", label: "Free shipping", hint: "Zeroes delivery. Leaves the goods alone." },
];

export function PromotionsTab() {
  const [view, setView] = useState<"discounts" | "gift-cards">("discounts");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setView("discounts")}
          className={chipCls(view === "discounts")}
        >
          Discount codes
        </button>
        <button
          type="button"
          onClick={() => setView("gift-cards")}
          className={chipCls(view === "gift-cards")}
        >
          Gift cards
        </button>
      </div>
      <div className="mt-8">
        {view === "discounts" ? <Discounts /> : <GiftCards />}
      </div>
    </div>
  );
}

function Discounts() {
  const [items, setItems] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: "",
    kind: "percent" as DiscountKind,
    value: "10",
    minSubtotal: "",
    usageLimit: "",
    perUserLimit: "",
    expiresAt: "",
    note: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await promotionsApi.listDiscounts({ page: 1, pageSize: 100 });
      setItems(result.items);
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      await promotionsApi.createDiscount({
        code: form.code,
        kind: form.kind,
        value:
          form.kind === "percent"
            ? Number(form.value) || 0
            : Math.round(Number(form.value) * 100) || 0,
        minSubtotalCents: form.minSubtotal
          ? Math.round(Number(form.minSubtotal) * 100)
          : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : undefined,
        expiresAt: form.expiresAt
          ? new Date(`${form.expiresAt}T23:59:59`).toISOString()
          : undefined,
        note: form.note || undefined,
      });
      setForm({ ...form, code: "", note: "" });
      setNote("Code created.");
      await load();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(code: DiscountCode) {
    try {
      await promotionsApi.updateDiscount(code.id, { isActive: !code.isActive });
      await load();
    } catch (err) {
      setNote(errorMessage(err));
    }
  }

  const kindHint = KINDS.find((k) => k.value === form.kind)?.hint;

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={create} className="flex flex-col gap-4 border border-subtle p-4">
        <p className={labelCls}>New discount code</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="d-code" label="Code">
            <input
              id="d-code"
              required
              value={form.code}
              placeholder="STIFF10"
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field id="d-kind" label="Type">
            <select
              id="d-kind"
              value={form.kind}
              onChange={(e) =>
                setForm({ ...form, kind: e.target.value as DiscountKind })
              }
              className={selectCls}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          {form.kind !== "free_shipping" && (
            <Field
              id="d-value"
              label={form.kind === "percent" ? "Percent" : "Amount (₾)"}
            >
              <input
                id="d-value"
                required
                type="number"
                min={form.kind === "percent" ? 1 : 0.01}
                max={form.kind === "percent" ? 100 : undefined}
                step={form.kind === "percent" ? 1 : 0.01}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className={inputCls}
              />
            </Field>
          )}
        </div>
        {kindHint && <p className="text-xs text-muted">{kindHint}</p>}

        <div className="grid gap-4 sm:grid-cols-4">
          <Field id="d-min" label="Min subtotal (₾)">
            <input
              id="d-min"
              type="number"
              min="0"
              step="0.01"
              value={form.minSubtotal}
              onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field id="d-uses" label="Total uses">
            <input
              id="d-uses"
              type="number"
              min="1"
              placeholder="unlimited"
              value={form.usageLimit}
              onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field id="d-per" label="Per customer">
            <input
              id="d-per"
              type="number"
              min="1"
              placeholder="unlimited"
              value={form.perUserLimit}
              onChange={(e) =>
                setForm({ ...form, perUserLimit: e.target.value })
              }
              className={inputCls}
            />
          </Field>
          <Field id="d-exp" label="Expires">
            <input
              id="d-exp"
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <Field id="d-note" label="What it's for">
          <input
            id="d-note"
            value={form.note}
            placeholder="Instagram drop, October"
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className={inputCls}
          />
        </Field>

        <button type="submit" disabled={busy} className={`${btnSolidSm} self-start`}>
          {busy ? "Creating…" : "Create code"}
        </button>
        {note && <p aria-live="polite" className="text-xs text-muted">{note}</p>}
      </form>

      {loading ? (
        <Loading label="Loading codes" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No codes yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b-2 border-foreground text-left text-[10px] uppercase tracking-[0.2em] text-muted">
                <th className="pb-2 pr-3">Code</th>
                <th className="pb-2 pr-3">Value</th>
                <th className="pb-2 pr-3">Min</th>
                <th className="pb-2 pr-3">Used</th>
                <th className="pb-2 pr-3">Expires</th>
                <th className="pb-2">State</th>
              </tr>
            </thead>
            <tbody>
              {items.map((code) => (
                <tr key={code.id} className="border-b border-subtle">
                  <td className="py-2.5 pr-3">
                    <span className="font-bold">{code.code}</span>
                    {code.note && (
                      <span className="block text-xs text-muted">{code.note}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    {code.kind === "percent" && `${code.value}%`}
                    {code.kind === "fixed" && formatPrice(code.value)}
                    {code.kind === "free_shipping" && "Free shipping"}
                  </td>
                  <td className="py-2.5 pr-3 text-muted">
                    {code.minSubtotalCents
                      ? formatPrice(code.minSubtotalCents)
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-muted">
                    {code.usedCount}
                    {code.usageLimit ? ` / ${code.usageLimit}` : ""}
                    {code.perUserLimit ? ` · ${code.perUserLimit} each` : ""}
                  </td>
                  <td className="py-2.5 pr-3 text-muted">
                    {code.expiresAt ? formatDate(code.expiresAt) : "—"}
                  </td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      onClick={() => toggle(code)}
                      className={btnGhostSm}
                    >
                      {code.isActive ? "Active" : "Off"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GiftCards() {
  const [items, setItems] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("50");
  const [cardNote, setCardNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await promotionsApi.listGiftCards({ page: 1, pageSize: 100 });
      setItems(result.items);
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const card = await promotionsApi.createGiftCard({
        initialCents: Math.round(Number(amount) * 100),
        note: cardNote || undefined,
      });
      setNote(`Issued ${card.code} — give this code to the customer.`);
      setCardNote("");
      await load();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={issue} className="flex flex-col gap-4 border border-subtle p-4">
        <p className={labelCls}>Issue a gift card</p>
        <p className="text-xs text-muted">
          The code is generated without vowels or lookalike characters, so it
          survives being read down a phone.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="g-amount" label="Amount (₾)">
            <input
              id="g-amount"
              required
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field id="g-note" label="Who it's for">
            <input
              id="g-note"
              value={cardNote}
              placeholder="Competition winner"
              onChange={(e) => setCardNote(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <button type="submit" disabled={busy} className={`${btnSolidSm} self-start`}>
          {busy ? "Issuing…" : "Issue card"}
        </button>
        {note && <p aria-live="polite" className="text-xs text-muted">{note}</p>}
      </form>

      {loading ? (
        <Loading label="Loading gift cards" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">None issued yet.</p>
      ) : (
        <ul className="border-t border-subtle">
          {items.map((card) => (
            <li
              key={card.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle py-3"
            >
              <div>
                <p className="font-bold">{card.code}</p>
                <p className="text-xs text-muted">
                  {formatPrice(card.remainingCents)} left of{" "}
                  {formatPrice(card.initialCents)}
                  {card.note && ` · ${card.note}`}
                </p>
              </div>
              <button
                type="button"
                className={btnGhostSm}
                onClick={async () => {
                  try {
                    await promotionsApi.setGiftCardActive(
                      card.id,
                      !card.isActive,
                    );
                    await load();
                  } catch (err) {
                    setNote(errorMessage(err));
                  }
                }}
              >
                {card.isActive ? "Active" : "Off"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
