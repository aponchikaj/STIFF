"use client";

/**
 * Opal packs: buying opals with money.
 *
 * Packs as cards, biggest number first in each — the opals are what is
 * being bought — with the price under it and the best value per lari
 * marked when the admin has not badged one already. Every state that
 * cannot buy says why instead of hiding the price list: signed out, not in
 * the season, or card payment not switched on yet.
 *
 * Checkout is a sheet with the method picker and a button that asks twice.
 * A bank that answers with a redirect is followed; the order is already on
 * record as pending by then.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { Sheet } from "@/components/sheet";
import { Empty, ErrorNote, Loading } from "@/components/ui";
import type {
  ApiError,
  OpalCheckoutResult,
  OpalMethodView,
  OpalPackView,
  OpalPaymentMethod,
} from "@/lib/api";
import { useBuyOpals, useOpals } from "@/lib/queries";
import { cn, formatNumber } from "@/lib/utils";
import { Bought, ConfirmButton, formatGel, OpalPrice, useCelebrate } from "./parts";

export function OpalPacks({
  signedIn,
  enrolled,
}: {
  signedIn: boolean;
  enrolled: boolean;
}) {
  const opals = useOpals();
  const [open, setOpen] = useState<OpalPackView | null>(null);

  const packs = opals.data?.packs ?? [];
  const methods = opals.data?.methods ?? [];
  const live = methods.filter((m) => m.available);
  const testMode = live.some((m) => m.testMode);

  // The best opals-per-lari, marked only when there is a real choice and
  // the admin has not already badged a pack themselves.
  const bestId =
    packs.length > 1 && !packs.some((p) => p.badge)
      ? packs.reduce((best, p) =>
          p.opals / p.priceCents > best.opals / best.priceCents ? p : best,
        ).id
      : null;

  const blocker: string | null = !signedIn
    ? "signed-out"
    : !enrolled
      ? "not-enrolled"
      : live.length === 0
        ? "no-card"
        : null;

  if (opals.isLoading) return <Loading label="COUNTING OPALS" />;
  if (opals.isError) {
    return <ErrorNote>The opal store could not be reached. Try again in a moment.</ErrorNote>;
  }

  return (
    <section className="flex flex-col gap-5">
      {testMode ? (
        <p className="bg-caution/10 px-3 py-2 font-body text-[11px] uppercase tracking-[0.12em] text-caution frame-notch">
          Test mode · no money moves
        </p>
      ) : null}

      {packs.length === 0 ? (
        <Empty icon="opal" title="No packs on sale">
          Opal packs go on sale here. Earn opals by playing and voting in the
          meantime.
        </Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {packs.map((pack, index) => (
            <motion.li
              key={pack.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <PackCard
                pack={pack}
                badge={pack.badge ?? (pack.id === bestId ? "Best value" : null)}
                onOpen={() => setOpen(pack)}
              />
            </motion.li>
          ))}
        </ul>
      )}

      {/* why it cannot be bought, said plainly */}
      {packs.length > 0 && blocker ? (
        <div className="flex items-start gap-3 bg-surface-2 px-4 py-3.5 frame-notch">
          <Icon name="warning" size="xs" className="mt-0.5 opacity-70" />
          <p className="font-body text-body-sm leading-[19px] text-ink-muted">
            {blocker === "signed-out" ? (
              <>
                <Link href="/login?next=/shop%23opals" className="text-cyan hover:underline">
                  Sign in
                </Link>{" "}
                to buy opals.
              </>
            ) : blocker === "not-enrolled" ? (
              <>
                Opals land on your season balance —{" "}
                <Link href="/join" className="text-cyan hover:underline">
                  join the season
                </Link>{" "}
                first.
              </>
            ) : (
              (methods[0]?.note ?? "Card payment is coming soon.")
            )}
          </p>
        </div>
      ) : null}

      <p className="font-body text-[11px] leading-[16px] text-ink-faint">
        Bought opals go on your season balance. What you have not spent when
        the season ends comes with you to the next one.
      </p>

      <PackSheet
        pack={open}
        live={live}
        blocker={blocker}
        onClose={() => setOpen(null)}
      />
    </section>
  );
}

function PackCard({
  pack,
  badge,
  onOpen,
}: {
  pack: OpalPackView;
  badge: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${pack.name}: ${formatNumber(pack.opals)} opals for ${formatGel(pack.priceCents)}`}
      className="group block w-full text-left transition-[filter] duration-200 hover:[filter:drop-shadow(0_0_2px_rgb(255_194_39/0.95))_drop-shadow(0_0_12px_rgb(255_194_39/0.45))]"
    >
      <span
        className={cn(
          "block p-px frame-notch transition-colors",
          badge ? "bg-coin/70" : "bg-blue-dim/60 group-hover:bg-coin",
        )}
      >
        <span className="relative flex flex-col items-center gap-3 bg-surface-2 px-3 pb-4 pt-7 text-center frame-notch">
          {badge ? (
            <span className="absolute left-1/2 top-0 -translate-x-1/2 bg-coin px-2 py-1 font-pixel text-[7px] uppercase tracking-[0.12em] text-void frame-notch">
              {badge}
            </span>
          ) : null}
          <motion.span
            whileHover={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 0.5 }}
          >
            <Icon name="opal" size="lg" glow="coin" />
          </motion.span>
          <span className="flex flex-col items-center gap-1">
            <span className="font-pixel text-[clamp(18px,5vw,24px)] leading-none tabular-nums text-coin text-glow-coin">
              {formatNumber(pack.opals)}
            </span>
            <span className="font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              opals
            </span>
          </span>
          <span className="w-full truncate font-pixel text-[8px] uppercase tracking-[0.1em] text-ink-faint">
            {pack.name}
          </span>
          <span className="w-full bg-surface-3 py-2 font-pixel text-[11px] tabular-nums text-ink frame-notch group-hover:bg-coin group-hover:text-void">
            {formatGel(pack.priceCents)}
          </span>
        </span>
      </span>
    </button>
  );
}

function PackSheet({
  pack,
  live,
  blocker,
  onClose,
}: {
  pack: OpalPackView | null;
  live: OpalMethodView[];
  blocker: string | null;
  onClose: () => void;
}) {
  const buy = useBuyOpals();
  const celebrate = useCelebrate();
  const [picked, setPicked] = useState<OpalPaymentMethod | null>(null);
  const [done, setDone] = useState<OpalCheckoutResult | null>(null);

  // The reader's pick while it is still live, else the first that works.
  // Derived, not synced: a bank switching off mid-visit moves the pick.
  const method =
    picked && live.some((m) => m.method === picked) ? picked : (live[0]?.method ?? null);
  const error = buy.error as ApiError | null;

  const close = () => {
    setDone(null);
    buy.reset();
    onClose();
  };

  if (!pack) return <Sheet open={false} onClose={close} label="Opal pack">{null}</Sheet>;

  return (
    <Sheet open onClose={close} label={`Buy ${pack.name}`} busy={buy.isPending}>
      {done ? (
        <Bought
          title={`+${formatNumber(done.order.opals)} opals`}
          detail={`They are on your balance${
            done.coins !== null ? ` — you have ${formatNumber(done.coins)} now` : ""
          }.${done.order.testMode ? " Test mode: no money moved." : ""}`}
          onDone={close}
        />
      ) : (
        <div className="flex flex-col gap-6 px-5 pb-6 pt-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <Icon name="opal" size="xl" glow="coin" />
            <OpalPrice amount={pack.opals} size="lg" />
            <span className="font-pixel text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              {pack.name}
            </span>
          </div>

          <div className="flex items-center justify-between border-y border-blue-dim/50 py-4">
            <span className="font-body text-body-sm text-ink-muted">You pay</span>
            <span className="font-pixel text-[16px] tabular-nums text-ink">
              {formatGel(pack.priceCents)}
            </span>
          </div>

          {live.length > 1 ? (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 font-body text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                Pay with
              </legend>
              {live.map((m) => {
                const active = m.method === method;
                return (
                  <label
                    key={m.method}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-4 py-3 frame-notch transition-colors",
                      active ? "bg-blue-deep" : "bg-surface-2 hover:bg-surface-3",
                    )}
                  >
                    <input
                      type="radio"
                      name="opal-method"
                      value={m.method}
                      checked={active}
                      onChange={() => setPicked(m.method)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={cn("size-2.5", active ? "bg-cyan shadow-[var(--glow-cyan-sm)]" : "bg-blue-dim")}
                    />
                    <span className="font-pixel text-[10px] uppercase tracking-[0.08em] text-ink">
                      {m.label}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ) : live.length === 1 ? (
            <p className="text-center font-body text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {live[0].label}
            </p>
          ) : null}

          {error ? <ErrorNote>{error.message}</ErrorNote> : null}

          {blocker === "signed-out" ? (
            <Link
              href="/login?next=/shop%23opals"
              className="block bg-blue py-4 text-center font-pixel text-[13px] uppercase tracking-[0.12em] text-void frame-notch hover:bg-cyan"
            >
              Sign in to buy
            </Link>
          ) : blocker === "not-enrolled" ? (
            <Link
              href="/join"
              className="block bg-blue py-4 text-center font-pixel text-[13px] uppercase tracking-[0.12em] text-void frame-notch hover:bg-cyan"
            >
              Join the season to buy
            </Link>
          ) : (
            <ConfirmButton
              label={blocker === "no-card" ? "Card payment coming soon" : `Pay ${formatGel(pack.priceCents)}`}
              confirmLabel={`Tap again · pay ${formatGel(pack.priceCents)}`}
              busy={buy.isPending}
              disabled={blocker === "no-card" || !method}
              onConfirm={() => {
                if (!method) return;
                buy.mutate(
                  { packId: pack.id, method },
                  {
                    onSuccess: (result) => {
                      if (result.next.kind === "redirect") {
                        window.location.assign(result.next.url);
                        return;
                      }
                      setDone(result);
                      celebrate();
                    },
                  },
                );
              }}
            />
          )}

        </div>
      )}
    </Sheet>
  );
}
