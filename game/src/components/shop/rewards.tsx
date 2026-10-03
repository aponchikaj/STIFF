"use client";

/**
 * Rewards: what opals buy.
 *
 * A grid of cards — the thing, its price, and whether *you* can have it:
 * sold out, at your limit, already yours, or how many opals short you are.
 * A card opens a sheet with the whole description and a buy button that
 * asks twice. A filter narrows the grid to what the balance covers.
 */

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { Sheet } from "@/components/sheet";
import { Empty, ErrorNote, Loading } from "@/components/ui";
import type { ApiError, ShopItemView } from "@/lib/api";
import { useAuthState, useBuy, useShopItems } from "@/lib/queries";
import { cn, formatNumber } from "@/lib/utils";
import { Bought, ConfirmButton, OpalPrice, useCelebrate } from "./parts";

type Standing =
  | { kind: "sold-out" }
  | { kind: "limit" }
  | { kind: "short"; need: number }
  | { kind: "ok" }
  | { kind: "unknown" };

/** Where the reader stands with an item — the one fact every card leads with. */
function standingFor(item: ShopItemView, balance: number | null): Standing {
  if (item.soldOut) return { kind: "sold-out" };
  if (item.perPersonLimit !== null && item.bought >= item.perPersonLimit) {
    return { kind: "limit" };
  }
  if (balance === null) return { kind: "unknown" };
  if (balance < item.priceCoins) return { kind: "short", need: item.priceCoins - balance };
  return { kind: "ok" };
}

export function Rewards({
  balance,
  canBuy,
  onTopUp,
}: {
  /** The season balance; null when signed out or not enrolled. */
  balance: number | null;
  /** Signed in and enrolled: the only state that can buy. */
  canBuy: boolean;
  onTopUp: () => void;
}) {
  const items = useShopItems();
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  const [open, setOpen] = useState<ShopItemView | null>(null);

  const all = items.data ?? [];
  const shown = onlyAffordable
    ? all.filter((i) => standingFor(i, balance).kind === "ok")
    : all;

  if (items.isLoading) return <Loading label="STOCKING THE SHELVES" />;

  if (items.isError) {
    return <ErrorNote>The shop could not be reached. Try again in a moment.</ErrorNote>;
  }

  if (all.length === 0) {
    return (
      <Empty icon="gift" title="Shelves restock during the season">
        Rewards go on sale here while a season runs. Hold on to your opals —
        they are worth more when there is something to spend them on.
      </Empty>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      {balance !== null ? (
        <div className="flex items-center justify-between gap-4">
          <span className="font-body text-caption uppercase tracking-[0.12em] text-ink-faint">
            {shown.length} of {all.length}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={onlyAffordable}
            onClick={() => setOnlyAffordable((v) => !v)}
            className="group inline-flex items-center gap-2.5 font-pixel text-[9px] uppercase tracking-[0.12em] text-ink-muted"
          >
            <span
              aria-hidden
              className={cn(
                "relative h-3.5 w-7 transition-colors frame-notch",
                onlyAffordable ? "bg-blue" : "bg-surface-3",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-2.5 bg-ink transition-[left] duration-200",
                  onlyAffordable ? "left-[15px]" : "left-0.5",
                )}
              />
            </span>
            What I can afford
          </button>
        </div>
      ) : null}

      {shown.length === 0 ? (
        <Empty icon="opal" title="Nothing in reach yet">
          Every reward costs more than you hold.{" "}
          <button type="button" onClick={onTopUp} className="text-cyan hover:underline">
            Top up
          </button>{" "}
          or earn more by playing.
        </Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {shown.map((item, index) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
              >
                <RewardCard
                  item={item}
                  standing={standingFor(item, balance)}
                  balance={balance}
                  onOpen={() => setOpen(item)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <RewardSheet
        item={open ? (all.find((i) => i.id === open.id) ?? open) : null}
        balance={balance}
        canBuy={canBuy}
        onClose={() => setOpen(null)}
        onTopUp={() => {
          setOpen(null);
          onTopUp();
        }}
      />
    </section>
  );
}

/* ================================================================= card */

function RewardCard({
  item,
  standing,
  balance,
  onOpen,
}: {
  item: ShopItemView;
  standing: Standing;
  balance: number | null;
  onOpen: () => void;
}) {
  const gone = standing.kind === "sold-out" || standing.kind === "limit";
  const progress =
    standing.kind === "short" && balance !== null
      ? Math.max(0.04, balance / item.priceCoins)
      : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${item.name}, ${formatNumber(item.priceCoins)} opals`}
      className="group block w-full text-left transition-[filter] duration-200 hover:[filter:drop-shadow(0_0_2px_rgb(1_163_255/0.9))_drop-shadow(0_0_12px_rgb(1_163_255/0.45))]"
    >
      <span className="block bg-blue-dim/60 p-px frame-notch transition-colors group-hover:bg-blue">
        <span className="flex flex-col bg-surface-2 frame-notch">
          {/* the thing */}
          <span className="relative block aspect-square overflow-hidden bg-surface-3 scanlines">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt=""
                loading="lazy"
                className={cn(
                  "size-full object-cover transition-transform duration-500 group-hover:scale-105",
                  gone && "opacity-35 grayscale",
                )}
              />
            ) : (
              <span className="flex size-full items-center justify-center">
                <Icon name="gift" size="xl" glow={!gone} dim={gone} />
              </span>
            )}

            {/* corner flags */}
            <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
              {standing.kind === "sold-out" ? (
                <Flag tone="heart">Sold out</Flag>
              ) : item.stock !== null && item.stock <= 5 ? (
                <Flag tone="caution">{item.stock} left</Flag>
              ) : null}
              {item.bought > 0 ? <Flag tone="good">Yours ×{item.bought}</Flag> : null}
            </span>
          </span>

          {/* name, price, standing */}
          <span className="flex flex-col gap-2.5 p-3">
            <span
              className={cn(
                "line-clamp-2 min-h-[2.4em] font-pixel text-[10px] uppercase leading-[1.2] tracking-[0.06em]",
                gone ? "text-ink-faint" : "text-ink",
              )}
            >
              {item.name}
            </span>
            <span className="flex items-center justify-between gap-2">
              <OpalPrice amount={item.priceCoins} dim={gone} />
              <span
                className={cn(
                  "font-body text-[10px] uppercase tracking-[0.1em]",
                  standing.kind === "ok"
                    ? "text-good"
                    : standing.kind === "short"
                      ? "text-caution"
                      : "text-ink-faint",
                )}
              >
                {standing.kind === "ok"
                  ? "In reach"
                  : standing.kind === "short"
                    ? `−${formatNumber(standing.need)}`
                    : standing.kind === "limit"
                      ? "Limit"
                      : standing.kind === "sold-out"
                        ? "Gone"
                        : ""}
              </span>
            </span>
            {progress !== null ? (
              <span className="block h-1 w-full bg-surface-3" aria-hidden>
                <span
                  className="block h-full bg-coin shadow-[var(--glow-coin)]"
                  style={{ width: `${progress * 100}%` }}
                />
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </button>
  );
}

function Flag({
  tone,
  children,
}: {
  tone: "heart" | "caution" | "good";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "px-1.5 py-1 font-pixel text-[7px] uppercase tracking-[0.1em] frame-notch",
        tone === "heart" && "bg-heart text-void",
        tone === "caution" && "bg-caution text-void",
        tone === "good" && "bg-good text-void",
      )}
    >
      {children}
    </span>
  );
}

/* ================================================================ sheet */

function RewardSheet({
  item,
  balance,
  canBuy,
  onClose,
  onTopUp,
}: {
  item: ShopItemView | null;
  balance: number | null;
  canBuy: boolean;
  onClose: () => void;
  onTopUp: () => void;
}) {
  const { isSignedIn } = useAuthState();
  const buy = useBuy();
  const celebrate = useCelebrate();
  const [boughtId, setBoughtId] = useState<string | null>(null);

  const close = () => {
    setBoughtId(null);
    buy.reset();
    onClose();
  };

  if (!item) return <Sheet open={false} onClose={close} label="Reward">{null}</Sheet>;

  const standing = standingFor(item, balance);
  const error = buy.error as ApiError | null;
  const after = balance !== null ? balance - item.priceCoins : null;

  return (
    <Sheet open onClose={close} label={item.name} busy={buy.isPending}>
      {boughtId === item.id ? (
        <Bought
          title="It's yours"
          detail={`${item.name} is in Yours, marked paid until it is handed over to you.${
            after !== null ? ` You have ${formatNumber(Math.max(0, after))} opals left.` : ""
          }`}
          onDone={close}
        />
      ) : (
        <div className="flex flex-col">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-3 scanlines">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center">
                <Icon name="gift" size="2xl" glow="lg" />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
          </div>

          <div className="flex flex-col gap-5 px-5 pb-6 pt-2">
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-[clamp(20px,5.5vw,28px)] uppercase leading-[1.05] text-ink text-glow pixel-snap">
                {item.name}
              </h2>
              <OpalPrice amount={item.priceCoins} size="lg" dim={standing.kind === "sold-out"} />
            </div>

            {item.description ? (
              <p className="whitespace-pre-line font-body text-body-sm leading-[21px] text-ink-muted">
                {item.description}
              </p>
            ) : null}

            {/* the facts that decide it */}
            <dl className="grid grid-cols-3 gap-3 border-y border-blue-dim/50 py-4">
              <Fact
                term="In stock"
                value={item.stock === null ? "Plenty" : item.soldOut ? "None" : formatNumber(item.stock)}
              />
              <Fact
                term="Per person"
                value={item.perPersonLimit === null ? "No limit" : `${item.perPersonLimit}`}
              />
              <Fact term="You own" value={formatNumber(item.bought)} />
            </dl>

            {after !== null && standing.kind === "ok" ? (
              <div className="flex items-center justify-between font-body text-body-sm text-ink-muted">
                <span>After buying</span>
                <OpalPrice amount={after} size="sm" />
              </div>
            ) : null}

            {error ? <ErrorNote>{error.message}</ErrorNote> : null}

            {!isSignedIn ? (
              <Link
                href="/login?next=/shop"
                className="block bg-blue py-4 text-center font-pixel text-[13px] uppercase tracking-[0.12em] text-void frame-notch hover:bg-cyan"
              >
                Sign in to buy
              </Link>
            ) : !canBuy ? (
              <Link
                href="/join"
                className="block bg-blue py-4 text-center font-pixel text-[13px] uppercase tracking-[0.12em] text-void frame-notch hover:bg-cyan"
              >
                Join the season to buy
              </Link>
            ) : standing.kind === "short" ? (
              <div className="flex flex-col gap-3">
                <p className="text-center font-body text-body-sm text-caution">
                  You are {formatNumber(standing.need)} opals short.
                </p>
                <button
                  type="button"
                  onClick={onTopUp}
                  className="block bg-coin py-4 font-pixel text-[13px] uppercase tracking-[0.12em] text-void frame-notch hover:brightness-110"
                >
                  Top up opals
                </button>
              </div>
            ) : (
              <ConfirmButton
                label={
                  standing.kind === "sold-out"
                    ? "Sold out"
                    : standing.kind === "limit"
                      ? "You have the most you can"
                      : `Buy for ${formatNumber(item.priceCoins)}`
                }
                confirmLabel={`Tap again · pay ${formatNumber(item.priceCoins)}`}
                busy={buy.isPending}
                disabled={standing.kind === "sold-out" || standing.kind === "limit"}
                onConfirm={() =>
                  buy.mutate(item.id, {
                    onSuccess: () => {
                      setBoughtId(item.id);
                      celebrate();
                    },
                  })
                }
              />
            )}

            <p className="text-center font-body text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              Purchases are final
            </p>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <dt className="font-body text-[10px] uppercase tracking-[0.12em] text-ink-faint">{term}</dt>
      <dd className="font-pixel text-[12px] text-ink">{value}</dd>
    </div>
  );
}
