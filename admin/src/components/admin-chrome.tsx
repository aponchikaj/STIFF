"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SHOP_URL } from "@/lib/shop-site";
import { AsteriskMark } from "./asterisk-mark";
import {
  IconAudit,
  IconBroadcast,
  IconCoins,
  IconCollab,
  IconComments,
  IconContacts,
  IconContent,
  IconExternal,
  IconGallery,
  IconLogout,
  IconOrders,
  IconOverview,
  IconProducts,
  IconTraffic,
  IconUsers,
} from "./nav-icons";
import { useSession } from "./providers";
import { ThemeToggle } from "./theme-toggle";
import { Badge, btnSecondary, Loading, pageTitle } from "./ui";

/**
 * The panel's sections, grouped by what the work actually is.
 *
 * Thirteen flat items is a list you re-read every time you need one. Three
 * groups — what sells, who it sells to, what the site says — is a shape you
 * learn once and then navigate from memory.
 *
 * Sections live in the URL rather than component state, so a view can be
 * bookmarked, sent to whoever is handling it, and survives a refresh.
 */
interface NavItem {
  href: Route;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Overview", icon: IconOverview },
      { href: "/traffic", label: "Traffic", icon: IconTraffic },
    ],
  },
  {
    label: "Selling",
    items: [
      { href: "/products", label: "Products", icon: IconProducts },
      { href: "/orders", label: "Orders", icon: IconOrders },
      { href: "/game-shop", label: "Game shop", icon: IconCoins },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/users", label: "Users", icon: IconUsers },
      { href: "/comments", label: "Comments", icon: IconComments },
      { href: "/contacts", label: "Contacts", icon: IconContacts },
      { href: "/broadcast", label: "Broadcast", icon: IconBroadcast },
    ],
  },
  {
    label: "The site",
    items: [
      { href: "/gallery", label: "Gallery", icon: IconGallery },
      { href: "/content", label: "Content", icon: IconContent },
      { href: "/collab", label: "Collab", icon: IconCollab },
      { href: "/audit", label: "Audit", icon: IconAudit },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

function titleFor(pathname: string): string {
  if (pathname === "/") return "Overview";
  const match = ALL.filter((s) => s.href !== "/").find((s) =>
    pathname.startsWith(s.href),
  );
  return match?.label ?? "Admin";
}

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const { user, loading, sessionError, refreshUser } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    // Only bounce to sign-in for an actual signed-out state. When the session
    // check failed for another reason the answer is unknown, and guessing
    // "signed out" would throw the admin out over a blip.
    if (loading || isLoginRoute || sessionError) return;
    if (!user) router.replace("/login");
  }, [loading, user, sessionError, isLoginRoute, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (isLoginRoute) return <main className="min-h-dvh">{children}</main>;

  if (!loading && !user && sessionError) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <AsteriskMark className="size-6 text-line-strong" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Can&apos;t reach the server
        </p>
        <p className="max-w-sm text-[13px] leading-6 text-muted">
          {sessionError}
        </p>
        <button
          type="button"
          onClick={() => void refreshUser()}
          className={btnSecondary}
        >
          Try again
        </button>
      </main>
    );
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <Loading label="Checking session" />
      </main>
    );
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-col">
        <TopBar
          title={titleFor(pathname)}
          onMenu={() => setMenuOpen((v) => !v)}
        />
        <main className="min-w-0 flex-1 px-5 pb-16 pt-6 sm:px-8">
          <div className="rise mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, logout, shopEnabled } = useSession();
  const router = useRouter();

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-ink/25 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-line bg-card transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 pb-6 pt-6">
          <AsteriskMark className="size-4 text-ink" />
          <span className="font-display text-[15px] tracking-[-0.01em]">
            STIFF
          </span>
          {/* Two panels look alike. Naming this one where the eye always
              lands is cheaper than a mistake made in the wrong window. */}
          <span className="ml-auto rounded-[var(--radius-pill)] border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
            Shop
          </span>
        </div>

        <nav aria-label="Sections" className="flex-1 overflow-y-auto px-3">
          {GROUPS.map((group, i) => (
            <div key={group.label ?? "root"} className={i === 0 ? "" : "mt-6"}>
              {group.label && (
                <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
                  {group.label}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-[var(--radius-control)] px-2.5 py-2 text-[13px] font-semibold transition-colors ${
                          active
                            ? "bg-ink text-card"
                            : "text-muted hover:bg-raised hover:text-ink"
                        }`}
                      >
                        <Icon className="size-[18px] shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          {!shopEnabled && (
            /* The kill-switch is easy to leave on by accident, and the shop
               looks perfectly fine from in here while it is. */
            <div className="mb-2 px-2.5">
              <Badge tone="caution">Shop hidden</Badge>
            </div>
          )}
          <a
            href={SHOP_URL}
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-[var(--radius-control)] px-2.5 py-2 text-[13px] font-semibold text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <IconExternal className="size-[18px] shrink-0" />
            View the shop
          </a>
          <div className="mt-2 flex items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-card">
              {user?.username?.slice(0, 1).toUpperCase() ?? "?"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-ink">
                {user?.username}
              </span>
              <span className="block text-[10px] uppercase tracking-[0.1em] text-faint">
                admin.stiff.ge
              </span>
            </span>
            <button
              type="button"
              aria-label="Log out"
              title="Log out"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
              className="text-muted transition-colors hover:text-danger"
            >
              <IconLogout className="size-[18px]" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function TopBar({ title, onMenu }: { title: string; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-page/85 px-5 py-4 backdrop-blur-md sm:px-8">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="-ml-1 inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] border border-line text-muted lg:hidden"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="size-[18px]"
          >
            <path d="M3 6h14M3 10h14M3 14h14" />
          </svg>
        </button>
        <h1 className={pageTitle}>{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
