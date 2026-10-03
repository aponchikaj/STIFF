"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Haze } from "@/components/crt";
import { Icon } from "@/components/icon";
import { History } from "@/components/shop/history";
import { OpalPacks } from "@/components/shop/opal-packs";
import { Rewards } from "@/components/shop/rewards";
import { Screen } from "@/components/ui";
import { useAuthState, useDashboard } from "@/lib/queries";
import { useChromeInsets } from "@/lib/reel-state";
import { cn, formatNumber } from "@/lib/utils";

/**
 * `/shop` — where opals go, and where they come from.
 *
 * The wallet first, because every decision below it is "can I afford
 * this": the balance, large and lit, and a way to top it up. Then three
 * tabs, each one job:
 *
 *   Rewards  what opals buy — cards that say whether *you* can have it
 *   Opals    buying opals with money
 *   Yours    what you bought, and its status
 *
 * The tab lives in the URL hash (`/shop#opals`) — the top bar's opal
 * counter links straight to the Opals tab, and a reload keeps your place.
 * Browsing is public: the shop is a reason to want an account.
 */

const TABS = [
  { id: "rewards", label: "Rewards", icon: "gift" },
  { id: "opals", label: "Opals", icon: "opal" },
  { id: "yours", label: "Yours", icon: "cart" },
] as const;

type Tab = (typeof TABS)[number]["id"];

/* -------------------------------------------------- the tab, in the hash */

/**
 * Every way the hash can change. `hashchange` alone misses one: Next.js's
 * `<Link href="/shop#opals">` — the top bar's opal counter — updates the
 * URL with `pushState`, which fires no `hashchange`, so clicking it while
 * already on /shop would not switch tabs. A click on any in-page link is
 * re-read once the router has moved; `popstate` covers back and forward.
 */
function subscribeHash(onChange: () => void) {
  const later = () => window.setTimeout(onChange, 0);
  const onClick = (event: MouseEvent) => {
    const link = (event.target as Element | null)?.closest?.("a[href]");
    if (link?.getAttribute("href")?.includes("#")) later();
  };
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  document.addEventListener("click", onClick);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    document.removeEventListener("click", onClick);
  };
}

function readTab(): Tab {
  const hash = window.location.hash.replace("#", "");
  return (TABS.find((t) => t.id === hash)?.id ?? "rewards") as Tab;
}

function goTo(tab: Tab) {
  // replaceState, then a synthetic hashchange: tabs should not each leave a
  // back-button stop, but the store still has to hear about it.
  const url = new URL(window.location.href);
  url.hash = tab === "rewards" ? "" : tab;
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export default function ShopPage() {
  const tab = useSyncExternalStore(subscribeHash, readTab, () => "rewards" as Tab);
  const { isSignedIn } = useAuthState();
  const dashboard = useDashboard();
  // The tabs stick just under the app's top bar, whatever its height.
  const insets = useChromeInsets();
  const enrolment = dashboard.data?.enrolment ?? null;
  const balance = enrolment?.coins ?? null;

  return (
    <main className="relative overflow-hidden">
      <Haze intensity="sm" />

      <Screen width="lg" className="flex flex-col gap-8 py-6 sm:py-8">
        <Wallet
          signedIn={isSignedIn}
          enrolled={enrolment !== null}
          balance={balance}
          onTopUp={() => goTo("opals")}
        />

        {/* tabs */}
        <nav
          aria-label="Shop"
          role="tablist"
          className="sticky z-20 -mx-4 grid grid-cols-3 bg-void/85 px-4 backdrop-blur-md sm:-mx-6 sm:px-6"
          style={{ top: insets.top }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`shop-${t.id}`}
                onClick={() => goTo(t.id)}
                className="relative flex min-h-12 items-center justify-center gap-2 py-3"
              >
                <Icon name={t.icon} size="xs" glow={active} dim={!active} />
                <span
                  className={cn(
                    "font-pixel text-[10px] uppercase tracking-[0.12em] transition-colors",
                    active ? "text-cyan text-glow-cyan-xs" : "text-ink-faint hover:text-ink-muted",
                  )}
                >
                  {t.label}
                </span>
                {active ? (
                  <motion.span
                    layoutId="shop-tab"
                    className="absolute inset-x-3 bottom-0 h-0.5 bg-cyan shadow-[var(--glow-cyan-sm)]"
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  />
                ) : null}
              </button>
            );
          })}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-blue-dim/60" />
        </nav>

        <motion.div
          key={tab}
          id={`shop-${tab}`}
          role="tabpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-[40vh]"
        >
          {tab === "rewards" ? (
            <Rewards
              balance={balance}
              canBuy={isSignedIn && enrolment !== null}
              onTopUp={() => goTo("opals")}
            />
          ) : tab === "opals" ? (
            <OpalPacks signedIn={isSignedIn} enrolled={enrolment !== null} />
          ) : (
            <History signedIn={isSignedIn} />
          )}
        </motion.div>
      </Screen>
    </main>
  );
}

/**
 * The wallet: what you hold, large, and the way to more. Signed out or
 * outside the season it says what would put a balance here instead.
 */
function Wallet({
  signedIn,
  enrolled,
  balance,
  onTopUp,
}: {
  signedIn: boolean;
  enrolled: boolean;
  balance: number | null;
  onTopUp: () => void;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="bloom-coin"
    >
      <div className="bg-coin/50 p-px frame-notch-lg">
        <div
          // `scanlines` here, not on an overlay span: the utility sets
          // `position: relative`, which would pull an `absolute` overlay
          // back into the flex row as an empty first item.
          className="scanlines relative flex flex-wrap items-center justify-between gap-5 overflow-hidden px-5 py-6 frame-notch-lg sm:px-7"
          style={{
            background:
              "radial-gradient(ellipse 70% 120% at 0% 0%, rgb(255 194 39 / 0.14), transparent 60%), var(--color-surface-2)",
          }}
        >
          <div className="relative flex items-center gap-4">
            <motion.span
              animate={{ y: [0, -4, 0], rotate: [0, -4, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Icon name="opal" size="xl" glow="coin" priority />
            </motion.span>
            <div className="flex flex-col gap-2">
              <span className="font-body text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                {signedIn && enrolled ? "Your opals" : "Shop"}
              </span>
              {signedIn && enrolled && balance !== null ? (
                <span className="font-pixel text-[clamp(28px,9vw,44px)] leading-none tabular-nums text-coin text-glow-coin">
                  {formatNumber(balance)}
                </span>
              ) : (
                <span className="max-w-[16rem] font-body text-body-sm leading-[19px] text-ink">
                  {!signedIn
                    ? "Sign in to see your opals and spend them."
                    : "Join the season to hold opals — players and watchers both earn them."}
                </span>
              )}
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-3">
            {!signedIn ? (
              <Link
                href="/login?next=/shop"
                className="bg-blue px-5 py-3 font-pixel text-[11px] uppercase tracking-[0.12em] text-void frame-notch hover:bg-cyan"
              >
                Sign in
              </Link>
            ) : !enrolled ? (
              <Link
                href="/join"
                className="bg-blue px-5 py-3 font-pixel text-[11px] uppercase tracking-[0.12em] text-void frame-notch hover:bg-cyan"
              >
                Join the season
              </Link>
            ) : (
              <button
                type="button"
                onClick={onTopUp}
                className="bg-coin px-5 py-3 font-pixel text-[11px] uppercase tracking-[0.12em] text-void frame-notch hover:brightness-110"
              >
                + Top up
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
