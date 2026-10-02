"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import {
  Body,
  Button,
  Dialog,
  Display,
  Empty,
  ErrorNote,
  Label,
  Loading,
  Rule,
  Screen,
} from "@/components/ui";
import type {
  ApiError,
  OpalCheckoutResult,
  OpalMethodView,
  OpalPackView,
  OpalPaymentMethod,
  ShopItemView,
} from "@/lib/api";
import {
  useAuthState,
  useBuy,
  useBuyOpals,
  useDashboard,
  useMyPurchases,
  useOpals,
  useShopItems,
} from "@/lib/queries";
import { cn, formatAgo, formatNumber } from "@/lib/utils";

/**
 * `/shop` — spend coins.
 *
 * Public to browse, which is the point: the shop is a reason to want an
 * account. Buying needs a session and an enrolment of either side —
 * players and watchers hold coins alike, and a watcher who votes all week
 * can outspend a player.
 *
 * The purchase is confirmed in a dialog rather than bought on tap. Coins
 * are earned slowly and can be bought with real money; a mis-tap that
 * spends 400 of them is not recoverable from the client.
 *
 * Opals — the coins — can be bought here too, above the items: the top
 * bar's Opals cell links to `#opals`, so "I'm short" is one tap from
 * "top up".
 */
export default function ShopPage() {
  const items = useShopItems();
  const purchases = useMyPurchases();
  const dashboard = useDashboard();
  const buy = useBuy();

  const [confirming, setConfirming] = useState<ShopItemView | null>(null);
  const balance = dashboard.data?.enrolment?.coins ?? null;
  const error = buy.error as ApiError | null;

  return (
    <main>
      <Screen width="md" className="flex flex-col gap-9 py-8">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-3">
            <Label>Opals in, rewards out</Label>
            <Display size="title">Shop</Display>
          </div>

          {balance !== null ? (
            <div className="flex items-center gap-3">
              <Icon name="opal" size="md" glow="coin" />
              <span className="font-pixel text-[22px] tabular-nums text-coin text-glow-coin">
                {formatNumber(balance)}
              </span>
            </div>
          ) : null}
        </header>

        <OpalStore enrolled={dashboard.data?.enrolment != null} />

        <Rule />

        {error ? <ErrorNote>{error.message}</ErrorNote> : null}

        {items.isLoading ? (
          <Loading />
        ) : (items.data?.length ?? 0) === 0 ? (
          <Empty icon="cart" title="Nothing for sale yet">
            Stock goes up during a season. Keep the coins.
          </Empty>
        ) : (
          <ul className="flex flex-col">
            {items.data?.map((item) => (
              <ShopRow
                key={item.id}
                item={item}
                balance={balance}
                onBuy={() => setConfirming(item)}
              />
            ))}
          </ul>
        )}

        {/* what you already own */}
        {(purchases.data?.length ?? 0) > 0 ? (
          <section className="flex flex-col gap-5 pt-6">
            <Rule />
            <Label>Yours</Label>
            <ul className="flex flex-col gap-3.5">
              {purchases.data?.map((purchase) => (
                <li key={purchase.id} className="flex items-center gap-4">
                  <Icon
                    name={
                      purchase.status === "fulfilled"
                        ? "gift"
                        : purchase.status === "cancelled"
                          ? "close"
                          : "cart"
                    }
                    size="xs"
                    glow={purchase.status === "fulfilled"}
                    dim={purchase.status === "cancelled"}
                  />
                  <span className="min-w-0 flex-1 truncate font-pixel text-[10px] uppercase tracking-[0.08em] text-ink">
                    {purchase.itemName}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-body text-[10px] uppercase tracking-[0.12em]",
                      purchase.status === "fulfilled"
                        ? "text-good"
                        : purchase.status === "cancelled"
                          ? "text-ink-faint line-through"
                          : "text-caution",
                    )}
                  >
                    {purchase.status}
                  </span>
                  <Label tone="faint">{formatAgo(purchase.createdAt)}</Label>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Screen>

      <Dialog
        open={Boolean(confirming)}
        title={confirming ? `Buy ${confirming.name}?` : ""}
        confirmLabel={confirming ? `Pay ${confirming.priceCoins}` : "Buy"}
        cancelLabel="Keep coins"
        busy={buy.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming) return;
          buy.mutate(confirming.id, { onSettled: () => setConfirming(null) });
        }}
      >
        {balance !== null && confirming
          ? `Leaves you ${formatNumber(Math.max(0, balance - confirming.priceCoins))}. Purchases are not refundable.`
          : "Purchases are not refundable."}
      </Dialog>
    </main>
  );
}

function ShopRow({
  item,
  balance,
  onBuy,
}: {
  item: ShopItemView;
  balance: number | null;
  onBuy: () => void;
}) {
  const affordable = balance === null || balance >= item.priceCoins;
  const limitReached =
    item.perPersonLimit !== null && item.bought >= item.perPersonLimit;
  const blocked = item.soldOut || limitReached;

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-5 py-5"
    >
      {/* the thing */}
      <div className="scanlines relative size-20 shrink-0 overflow-hidden bg-surface-2">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className={cn(
              "size-full object-cover",
              blocked && "opacity-30 grayscale",
            )}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Icon name="gift" size="sm" dim={blocked} />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span
          className={cn(
            "truncate font-pixel text-[12px] uppercase tracking-[0.08em]",
            blocked ? "text-ink-faint" : "text-ink",
          )}
        >
          {item.name}
        </span>

        {item.description ? (
          <Body size="sm" className="line-clamp-2 text-ink-faint">
            {item.description}
          </Body>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {item.stock !== null ? (
            <Label tone={item.stock === 0 ? "heart" : "faint"}>
              {item.stock === 0 ? "Sold out" : `${item.stock} left`}
            </Label>
          ) : null}
          {item.bought > 0 ? (
            <Label tone="good">You own {item.bought}</Label>
          ) : null}
          {limitReached ? <Label tone="faint">Limit reached</Label> : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <Icon name="opal" size="xs" glow="coin" dim={blocked} />
          <span
            className={cn(
              "font-pixel text-[13px] tabular-nums",
              blocked
                ? "text-ink-faint"
                : affordable
                  ? "text-coin text-glow-coin"
                  : "text-ink-faint",
            )}
          >
            {formatNumber(item.priceCoins)}
          </span>
        </div>

        <Button
          size="sm"
          variant="coin"
          marker={false}
          disabled={blocked || !affordable}
          onClick={onBuy}
        >
          {item.soldOut
            ? "Gone"
            : limitReached
              ? "Limit"
              : !affordable
                ? "Short"
                : "Buy"}
        </Button>
      </div>
    </motion.li>
  );
}

/* ================================================================ opals */

/**
 * Tetri to "5 GEL" or "4.50 GEL" — whole lari drop the ".00", which in a
 * 1em-per-glyph pixel face is three characters of nothing. The face has no
 * ₾ glyph, so the code it is.
 */
function formatGel(cents: number): string {
  const lari = cents / 100;
  return `${cents % 100 === 0 ? lari.toFixed(0) : lari.toFixed(2)} GEL`;
}

/**
 * Buy opals with money.
 *
 * A grid of packs, a card picker when more than one acquirer is live, and
 * a confirm step — this one spends lari, not coins, so it is never one tap.
 * Every state that cannot buy says why instead of hiding the packs:
 * signed out, not in the season, or card payment not switched on yet. The
 * price list is worth seeing either way.
 */
function OpalStore({ enrolled }: { enrolled: boolean }) {
  const { isSignedIn } = useAuthState();
  const opals = useOpals();
  const buy = useBuyOpals();

  const methods = opals.data?.methods ?? [];
  const live = methods.filter((m) => m.available);
  const [picked, setMethod] = useState<OpalPaymentMethod | null>(null);
  const [confirming, setConfirming] = useState<OpalPackView | null>(null);
  const [done, setDone] = useState<OpalCheckoutResult | null>(null);

  // The player's pick while it is still live, else the first card that
  // works. Derived, not synced: an acquirer switching off mid-visit just
  // moves the selection, with no effect to fall out of step.
  const method: OpalPaymentMethod | null =
    picked && live.some((m) => m.method === picked)
      ? picked
      : (live[0]?.method ?? null);

  const chosen: OpalMethodView | undefined = live.find((m) => m.method === method);
  const testMode = live.some((m) => m.testMode);
  const packs = opals.data?.packs ?? [];
  const error = buy.error as ApiError | null;

  const blocker = !isSignedIn
    ? "signed-out"
    : !enrolled
      ? "not-enrolled"
      : live.length === 0
        ? "no-card"
        : null;

  return (
    <section id="opals" className="flex scroll-mt-48 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Label>Top up</Label>
          <Display size="hero">Get opals</Display>
        </div>
        {testMode ? (
          <Label tone="caution" className="font-semibold">
            Test mode · no money moves
          </Label>
        ) : null}
      </div>

      {live.length > 1 && blocker === null ? (
        <div className="flex flex-wrap items-center gap-3" role="radiogroup" aria-label="Pay with">
          <Label tone="muted">Pay with</Label>
          {live.map((m) => {
            const active = m.method === method;
            return (
              <button
                key={m.method}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMethod(m.method)}
                className={cn(
                  "frame-notch px-3 py-2 font-pixel text-[10px] uppercase tracking-[0.1em] transition-colors",
                  active
                    ? "bg-blue-dim text-cyan text-glow-cyan-xs"
                    : "bg-surface-2 text-ink-faint hover:text-ink",
                )}
              >
                {m.method === "card_tbc" ? "TBC card" : "BOG card"}
              </button>
            );
          })}
        </div>
      ) : null}

      {done ? (
        <div className="flex items-center gap-3" role="status">
          <Icon name="opal" size="sm" glow="coin" />
          <Body size="sm" className="text-good">
            +{formatNumber(done.order.opals)} opals added
            {done.coins !== null ? ` — you have ${formatNumber(done.coins)}` : ""}.
            {done.order.testMode ? " Test mode: no money moved." : ""}
          </Body>
        </div>
      ) : null}
      {error ? <ErrorNote>{error.message}</ErrorNote> : null}

      {opals.isLoading ? (
        <Loading />
      ) : packs.length === 0 ? (
        <Empty icon="opal" title="No packs yet">
          Opal packs go on sale here. Earn them by playing in the meantime.
        </Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {packs.map((pack) => (
            <li key={pack.id}>
              <OpalPackCard
                pack={pack}
                disabled={blocker !== null}
                onPick={() => {
                  setDone(null);
                  buy.reset();
                  setConfirming(pack);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {blocker === "signed-out" ? (
        <Body size="sm" className="text-ink-muted">
          <Link href="/login" className="text-cyan underline-offset-4 hover:underline">
            Sign in
          </Link>{" "}
          to buy opals.
        </Body>
      ) : blocker === "not-enrolled" ? (
        <Body size="sm" className="text-ink-muted">
          Opals land on your season balance —{" "}
          <Link href="/join" className="text-cyan underline-offset-4 hover:underline">
            join the season
          </Link>{" "}
          first.
        </Body>
      ) : blocker === "no-card" && packs.length > 0 ? (
        <Body size="sm" className="text-ink-muted">
          Card payment is coming soon.
        </Body>
      ) : null}

      <Dialog
        open={Boolean(confirming)}
        title={confirming ? `Buy ${confirming.name}?` : ""}
        confirmLabel={confirming ? `Pay ${formatGel(confirming.priceCents)}` : "Pay"}
        cancelLabel="Cancel"
        busy={buy.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming || !method) return;
          buy.mutate(
            { packId: confirming.id, method },
            {
              onSuccess: (result) => {
                if (result.next.kind === "redirect") {
                  // The bank's page takes it from here; the order is
                  // already on record as pending.
                  window.location.assign(result.next.url);
                  return;
                }
                setDone(result);
              },
              onSettled: () => setConfirming(null),
            },
          );
        }}
      >
        {confirming
          ? `${formatNumber(confirming.opals)} opals for ${formatGel(confirming.priceCents)}${
              chosen ? ` by ${chosen.label}` : ""
            }. They go on your season balance, and whatever you have not spent comes with you to the next season.${
              testMode ? " Test mode: no card is charged." : ""
            }`
          : ""}
      </Dialog>
    </section>
  );
}

/**
 * One pack. A whole-card button: the opal count is what someone is buying,
 * so it is the largest thing on it, and the price sits under it.
 *
 * Notched with the hairline trick (a 1px blue parent notch around a
 * surface child notch) and the hover bloom on the outermost element,
 * because a glow beside a clip-path is clipped away with the corners.
 */
function OpalPackCard({
  pack,
  disabled,
  onPick,
}: {
  pack: OpalPackView;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      aria-label={`${pack.name}: ${pack.opals} opals for ${formatGel(pack.priceCents)}`}
      className="group block w-full text-left transition-[filter] duration-200 enabled:hover:[filter:drop-shadow(0_0_2px_rgb(255_194_39/0.95))_drop-shadow(0_0_10px_rgb(255_194_39/0.5))] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="frame-notch block bg-blue-dim/70 p-px transition-colors group-enabled:group-hover:bg-coin">
        <span className="frame-notch relative flex flex-col items-center gap-2.5 bg-surface-2 px-3 pt-6 pb-4 text-center">
          {pack.badge ? (
            <span className="absolute top-2 left-1/2 -translate-x-1/2 truncate font-body text-[10px] font-bold uppercase tracking-[0.14em] text-coin">
              {pack.badge}
            </span>
          ) : null}
          <Icon name="opal" size="md" glow="coin" />
          <span className="flex flex-col items-center gap-1">
            <span className="font-pixel text-[18px] leading-6 tabular-nums text-coin text-glow-coin sm:text-[20px]">
              {formatNumber(pack.opals)}
            </span>
            <Label tone="muted" className="text-[11px] font-semibold">
              Opals
            </Label>
          </span>
          <span className="w-full truncate font-pixel text-[9px] uppercase tracking-[0.1em] text-ink-faint">
            {pack.name}
          </span>
          <span className="font-pixel text-[12px] tabular-nums text-ink">
            {formatGel(pack.priceCents)}
          </span>
        </span>
      </span>
    </button>
  );
}
