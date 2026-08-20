"use client";

import { useState } from "react";
import { customersApi } from "@/lib/api";
import type { ProductVariant } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { useSession } from "./providers";
import { btnOutline, inputCls, labelCls } from "./ui";

/**
 * "Tell me when this is back", on a size that is gone.
 *
 * Deliberately open to people without an account — they cannot buy the thing
 * yet either, so demanding a signup first is the wrong moment to ask.
 */
export function StockAlertButton({
  variant,
  productName,
}: {
  variant: ProductVariant;
  productName: string;
}) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      await customersApi.subscribeToStock({
        variantId: variant.id,
        email: user ? undefined : email.trim(),
      });
      setDone(true);
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p
        aria-live="polite"
        className="mt-4 border border-subtle p-3 text-xs leading-6 text-muted"
      >
        We&apos;ll tell you the moment {productName}
        {variant.size ? ` in ${variant.size}` : ""} is back. Once only — we
        won&apos;t keep messaging you.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${btnOutline} mt-4`}
      >
        Tell me when it&apos;s back
      </button>
    );
  }

  return (
    <form onSubmit={subscribe} className="mt-4 border border-subtle p-4">
      <p className={labelCls}>
        {variant.size ? `${variant.size} — ` : ""}back in stock alert
      </p>
      {!user && (
        <>
          <label htmlFor="alert-email" className="sr-only">
            Email
          </label>
          <input
            id="alert-email"
            type="email"
            required
            value={email}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputCls} mt-3`}
          />
        </>
      )}
      {user && (
        <p className="mt-2 text-xs text-muted">
          We&apos;ll notify you at {user.email}.
        </p>
      )}
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex h-10 items-center rounded-[2px] bg-foreground px-5 text-[11px] font-bold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Notify me"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-10 items-center rounded-[2px] border border-subtle px-5 text-[11px] font-medium uppercase tracking-[0.15em] text-muted hover:border-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
