"use client";

/**
 * Yours: what you bought with opals, and the opals you bought.
 *
 * Two short ledgers, newest first, each row ending in its status as a
 * coloured chip — a reward is paid until it is handed over, an opal order
 * is pending until the bank answers.
 */

import Link from "next/link";
import { Icon } from "@/components/icon";
import { Empty, Label, Loading } from "@/components/ui";
import type { OpalOrderStatus, PurchaseStatus } from "@/lib/api";
import { useMyOpalOrders, useMyPurchases } from "@/lib/queries";
import { cn, formatAgo } from "@/lib/utils";
import { formatGel, OpalPrice } from "./parts";

const PURCHASE: Record<PurchaseStatus, { word: string; tone: Tone }> = {
  paid: { word: "Paid · on its way", tone: "caution" },
  fulfilled: { word: "Handed over", tone: "good" },
  cancelled: { word: "Cancelled · refunded", tone: "faint" },
};

const ORDER: Record<OpalOrderStatus, { word: string; tone: Tone }> = {
  pending: { word: "Waiting on the bank", tone: "caution" },
  paid: { word: "Added", tone: "good" },
  failed: { word: "Failed", tone: "heart" },
};

type Tone = "good" | "caution" | "heart" | "faint";

export function History({ signedIn }: { signedIn: boolean }) {
  const purchases = useMyPurchases();
  const orders = useMyOpalOrders(signedIn);

  if (!signedIn) {
    return (
      <Empty icon="profile" title="Sign in to see yours">
        <Link href="/login?next=/shop%23yours" className="text-cyan hover:underline">
          Sign in
        </Link>{" "}
        and everything you buy shows up here.
      </Empty>
    );
  }

  if (purchases.isLoading || orders.isLoading) return <Loading label="READING YOUR RECEIPTS" />;

  const bought = purchases.data ?? [];
  const topUps = orders.data ?? [];

  if (bought.length === 0 && topUps.length === 0) {
    return (
      <Empty icon="cart" title="Nothing yet">
        Rewards you buy and opals you top up with show up here.
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {bought.length > 0 ? (
        <section className="flex flex-col gap-3">
          <Label>Rewards</Label>
          <ul className="flex flex-col divide-y divide-blue-dim/40">
            {bought.map((p) => (
              <li key={p.id} className="flex items-center gap-4 py-3.5">
                <Icon
                  name={p.status === "fulfilled" ? "gift" : p.status === "cancelled" ? "close" : "cart"}
                  size="sm"
                  glow={p.status === "fulfilled"}
                  dim={p.status === "cancelled"}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span
                    className={cn(
                      "truncate font-pixel text-[10px] uppercase tracking-[0.06em]",
                      p.status === "cancelled" ? "text-ink-faint line-through" : "text-ink",
                    )}
                  >
                    {p.itemName}
                  </span>
                  <span className="flex items-center gap-3">
                    <OpalPrice amount={p.priceCoins} size="sm" dim={p.status === "cancelled"} />
                    <span className="font-body text-[11px] text-ink-faint">{formatAgo(p.createdAt)}</span>
                  </span>
                  {p.note ? (
                    <span className="font-body text-[12px] leading-[16px] text-ink-muted">{p.note}</span>
                  ) : null}
                </div>
                <Chip tone={PURCHASE[p.status].tone}>{PURCHASE[p.status].word}</Chip>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {topUps.length > 0 ? (
        <section className="flex flex-col gap-3">
          <Label>Opal top-ups</Label>
          <ul className="flex flex-col divide-y divide-blue-dim/40">
            {topUps.map((o) => (
              <li key={o.id} className="flex items-center gap-4 py-3.5">
                <Icon name="opal" size="sm" glow={o.status === "paid" ? "coin" : undefined} dim={o.status === "failed"} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-pixel text-[10px] uppercase tracking-[0.06em] text-ink">
                    +{o.opals} opals
                  </span>
                  <span className="font-body text-[11px] text-ink-faint">
                    {formatGel(o.priceCents)} · {formatAgo(o.createdAt)}
                    {o.testMode ? " · test" : ""}
                  </span>
                </div>
                <Chip tone={ORDER[o.status].tone}>{ORDER[o.status].word}</Chip>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "max-w-[42%] shrink-0 px-2 py-1 text-right font-body text-[10px] uppercase leading-[13px] tracking-[0.1em] frame-notch",
        tone === "good" && "bg-good/15 text-good",
        tone === "caution" && "bg-caution/15 text-caution",
        tone === "heart" && "bg-heart/15 text-heart",
        tone === "faint" && "bg-surface-3 text-ink-faint",
      )}
    >
      {children}
    </span>
  );
}
