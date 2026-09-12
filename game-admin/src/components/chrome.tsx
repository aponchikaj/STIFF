"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GAME_URL } from "@/lib/game-site";
import { AsteriskMark } from "./asterisk-mark";
import {
  IconBoard,
  IconExternal,
  IconLogout,
  IconOverview,
  IconPlayers,
  IconReports,
  IconReview,
  IconSeason,
  IconShop,
  IconTasks,
} from "./nav-icons";
import { useSession } from "./providers";
import { ThemeToggle } from "./theme-toggle";
import { btnSecondary, Loading, pageTitle } from "./ui";

/**
 * The panel's sections, in the order an operator meets them on a season day:
 * what is happening, the season itself, the queue waiting on a person, the
 * people, the board, then what was set up in advance — the task pool and the
 * coin shop — and finally what players have reported.
 *
 * Grouped, because eight flat items is a list you read every time and three
 * groups of two or three is a shape you learn once. `Today` is what changes
 * hour to hour; `Setup` is what you prepare between seasons.
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
    items: [{ href: "/", label: "Overview", icon: IconOverview }],
  },
  {
    label: "Today",
    items: [
      { href: "/review", label: "Review", icon: IconReview },
      { href: "/reports", label: "Reports", icon: IconReports },
      { href: "/players", label: "Players", icon: IconPlayers },
      { href: "/board", label: "Board", icon: IconBoard },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/seasons", label: "Seasons", icon: IconSeason },
      { href: "/tasks", label: "Tasks", icon: IconTasks },
      { href: "/shop", label: "Coin shop", icon: IconShop },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

function titleFor(pathname: string): string {
  if (pathname === "/") return "Overview";
  const match = ALL.filter((s) => s.href !== "/").find((s) =>
    pathname.startsWith(s.href),
  );
  return match?.label ?? "Game";
}

export function Chrome({ children }: { children: React.ReactNode }) {
  const { user, loading, sessionError, refreshUser } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    // Only bounce to sign-in for an actual signed-out state. When the session
    // check failed for another reason the answer is unknown, and guessing
    // "signed out" would throw the operator out over a blip.
    if (loading || isLoginRoute || sessionError) return;
    if (!user) router.replace("/login");
  }, [loading, user, sessionError, isLoginRoute, router]);

  // A tap on a section should not leave the drawer sitting over the screen.
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
  const { user, logout } = useSession();
  const router = useRouter();

  return (
    <>
      {/* The drawer's backdrop only exists on small screens, where the rail
          is over the content rather than beside it. */}
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
          {/* The two panels look alike. Saying which one this is, in the one
              place the eye always lands, is cheaper than a mistake. */}
          <span className="ml-auto rounded-[var(--radius-pill)] border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
            Game
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
          <a
            href={GAME_URL}
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-[var(--radius-control)] px-2.5 py-2 text-[13px] font-semibold text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <IconExternal className="size-[18px] shrink-0" />
            View the game
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
                admin.stiff.co
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
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-[18px]">
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
