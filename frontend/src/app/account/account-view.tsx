"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authApi, customersApi, profileApi } from "@/lib/api";
import type { OrderStatus, UserAddress } from "@/lib/api";
import { formatDate, formatPrice, shortId } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { Reveal } from "@/components/motion";
import { SavedGrid } from "@/components/saved-grid";
import { useSession } from "@/components/providers";
import { variantLabel } from "@/lib/checkout";
import {
  btnGhostSm,
  btnOutline,
  btnSolidSm,
  Field,
  inputCls,
  Loading,
  selectCls,
} from "@/components/ui";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  packed: "Packed",
  shipped: "Out",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function AccountView() {
  const { user, loading, unreadCount, logout } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/account");
  }, [loading, user, router]);

  if (loading || !user) return <Loading label="Loading account" />;

  return (
    <div className="flex flex-col gap-14">
      <Reveal>
        <Header
          unreadCount={unreadCount}
          onLogout={async () => {
            await logout();
            router.push("/");
          }}
        />
      </Reveal>
      {!user.isVerified && <VerifyBanner />}
      <Reveal delay={0.05}>
        <Stats />
      </Reveal>
      <Reveal delay={0.1}>
        <Saved />
        <Addresses />
        <Orders />
      </Reveal>
    </div>
  );
}

function Header({
  unreadCount,
  onLogout,
}: {
  unreadCount: number;
  onLogout: () => void;
}) {
  const { user } = useSession();
  if (!user) return null;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
            {user.username}
          </h1>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {user.email} · member since {formatDate(user.createdAt)}
            {user.isVerified ? " · verified" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user.role === "admin" && (
            <Link href="/admin" className={btnOutline}>
              Admin panel
            </Link>
          )}
          <Link href="/notifications" className={btnOutline}>
            Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </Link>
          <Link href="/settings" className={btnOutline}>
            Settings
          </Link>
          <button type="button" onClick={onLogout} className={btnOutline}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

function VerifyBanner() {
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="border border-subtle p-4">
      <p className="text-xs leading-6 text-muted">
        Your email isn&apos;t verified yet — you&apos;ll need that to place
        orders. Check your inbox for the link.
      </p>
      <p className="mt-2 text-xs leading-6 text-muted">
        {/* The claim runs on verification, not on signup, so this is the one
            place someone would otherwise wonder where their order went. */}
        Ordered as a guest with this address before? Verifying pulls those
        orders into your history.
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            await authApi.resendVerification();
            setNote("Verification email sent.");
          } catch (err) {
            setNote(errorMessage(err));
          }
        }}
        className={`${btnGhostSm} mt-2`}
      >
        Resend verification email
      </button>
      <p aria-live="polite" className="mt-1 text-xs text-muted">
        {note}
      </p>
    </div>
  );
}

function Stats() {
  const { data, loading } = useAsync(() => profileApi.getStats(), []);
  if (loading) return <Loading label="Loading stats" />;
  if (!data) return null;

  const tiles = [
    { label: "Total spent", value: formatPrice(data.totalSpentCents) },
    { label: "Orders", value: String(data.ordersCount) },
    { label: "Comments", value: String(data.commentsCount) },
    { label: "Likes given", value: String(data.likesGivenCount) },
  ];

  return (
    <section aria-label="Stats">
      <ul className="grid grid-cols-2 gap-px border border-subtle bg-subtle sm:grid-cols-4">
        {tiles.map(({ label, value }) => (
          <li key={label} className="bg-background p-4 sm:p-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              {label}
            </p>
            <p className="mt-2 font-display text-2xl uppercase tracking-tight sm:text-3xl">
              {value}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Saved delivery addresses.
 *
 * Exactly one is the default and checkout preselects it; the server keeps that
 * true, including when the default is the one being deleted.
 */
function Addresses() {
  const { data, reload } = useAsync(() => customersApi.listAddresses(), []);
  const { data: regionData } = useAsync(() => customersApi.getRegions(), []);
  const regions = regionData?.regions ?? ["Tbilisi"];
  const addresses = data ?? [];

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setNote(null);
    try {
      await customersApi.createAddress({
        label: String(form.get("label") ?? ""),
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        line1: String(form.get("line1") ?? ""),
        city: String(form.get("city") ?? ""),
        region: String(form.get("region") ?? ""),
        postalCode: String(form.get("postalCode") ?? ""),
        phone: String(form.get("phone") ?? ""),
        isDefault: form.get("isDefault") === "on",
      });
      setOpen(false);
      reload();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await customersApi.deleteAddress(id);
      reload();
    } catch (err) {
      setNote(errorMessage(err));
    }
  }

  async function makeDefault(address: UserAddress) {
    try {
      await customersApi.updateAddress(address.id, {
        firstName: address.firstName,
        lastName: address.lastName,
        line1: address.line1,
        city: address.city,
        region: address.region ?? undefined,
        postalCode: address.postalCode ?? undefined,
        phone: address.phone,
        label: address.label,
        isDefault: true,
      });
      reload();
    } catch (err) {
      setNote(errorMessage(err));
    }
  }

  return (
    <section aria-label="Addresses">
      <h2 className="text-2xl uppercase tracking-tight sm:text-4xl">
        Addresses
      </h2>

      {addresses.length === 0 && !open && (
        <p className="mt-4 text-sm text-muted">
          Save an address and checkout fills itself in next time.
        </p>
      )}

      {addresses.length > 0 && (
        <ul className="mt-6 border-t border-subtle">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-wrap items-start justify-between gap-3 border-b border-subtle py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-wide">
                  {address.label || "Address"}
                  {address.isDefault && (
                    <span className="ml-2 text-[10px] tracking-[0.2em] text-muted">
                      DEFAULT
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs leading-6 text-muted">
                  {[
                    `${address.firstName} ${address.lastName}`.trim(),
                    address.line1,
                    address.city,
                    address.region,
                    address.postalCode,
                    address.phone,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              <div className="flex gap-1">
                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={() => makeDefault(address)}
                    className={btnGhostSm}
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(address.id)}
                  className={btnGhostSm}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {note && <p className="mt-3 text-xs text-muted">{note}</p>}

      {open ? (
        <form onSubmit={save} className="mt-6 flex flex-col gap-4 border border-subtle p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="a-label" label="Label">
              <input id="a-label" name="label" placeholder="Home" className={inputCls} />
            </Field>
            <Field id="a-phone" label="Phone">
              <input
                id="a-phone"
                name="phone"
                type="tel"
                required
                placeholder="555 12 34 56"
                className={inputCls}
              />
            </Field>
            <Field id="a-first" label="Name">
              <input id="a-first" name="firstName" required className={inputCls} />
            </Field>
            <Field id="a-last" label="Last name">
              <input id="a-last" name="lastName" required className={inputCls} />
            </Field>
          </div>
          <Field id="a-line1" label="Address">
            <input id="a-line1" name="line1" required className={inputCls} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="a-city" label="City">
              <input id="a-city" name="city" required className={inputCls} />
            </Field>
            <Field id="a-region" label="Region">
              <select id="a-region" name="region" defaultValue="Tbilisi" className={selectCls}>
                {regions.map((region: string) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="a-post" label="Postcode (optional)">
              <input id="a-post" name="postalCode" inputMode="numeric" className={inputCls} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="isDefault" className="size-4" />
            Use this by default
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={btnSolidSm}>
              {busy ? "Saving…" : "Save address"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={btnGhostSm}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${btnGhostSm} mt-4`}
        >
          Add an address
        </button>
      )}
    </section>
  );
}

function Orders() {
  const [page, setPage] = useState(1);
  const { data, loading } = useAsync(
    () => profileApi.getMyOrders({ page, pageSize: 5 }),
    [page],
  );
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / 5));

  return (
    <section aria-label="Orders">
      <h2 className="text-2xl uppercase tracking-tight sm:text-4xl">Orders</h2>
      {loading && <Loading label="Loading orders" />}
      {data && data.items.length === 0 && (
        <p className="mt-6 text-sm text-muted">
          No orders yet.{" "}
          <Link
            href="/clothing"
            className="rounded-[2px] font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            Start with the first drop.
          </Link>
        </p>
      )}
      <ul className="mt-6 border-t border-subtle">
        {data?.items.map((order) => (
          <li key={order.id} className="border-b border-subtle py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide">
                #{shortId(order.id)}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                {formatDate(order.createdAt)} · {STATUS_LABEL[order.status]}
              </p>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between gap-3 text-xs text-muted"
                >
                  <span className="truncate">
                    {item.quantity} × {item.productName}
                    {variantLabel(item.color, item.size)
                      ? ` (${variantLabel(item.color, item.size)})`
                      : ""}
                  </span>
                  <span>{formatPrice(item.unitPriceCents * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-bold">
              {formatPrice(order.totalCents)}
            </p>
          </li>
        ))}
      </ul>
      {pageCount > 1 && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className={btnGhostSm}
          >
            ← Prev
          </button>
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className={btnGhostSm}
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}


/**
 * Saved pieces.
 *
 * The same grid `/saved` renders, so a signed-out list and a signed-in one
 * cannot drift apart — there is one implementation of "what did I save".
 */
function Saved() {
  return (
    <section aria-label="Saved" className="mb-14">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl uppercase tracking-tight sm:text-4xl">Saved</h2>
        <Link href="/saved" className={btnGhostSm}>
          Open saved
        </Link>
      </div>
      <div className="mt-6">
        <SavedGrid />
      </div>
    </section>
  );
}
