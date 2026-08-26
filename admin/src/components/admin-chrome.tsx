"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "./providers";
import { ThemeToggle } from "./theme-toggle";
import { btnGhostSm, chipCls, Loading } from "./ui";

/**
 * Sections live in the URL rather than component state, so a view can be
 * bookmarked, shared with whoever is handling it, and survives a refresh.
 */
const SECTIONS = [
  { href: "/", label: "Overview" },
  { href: "/traffic", label: "Traffic" },
  { href: "/products", label: "Products" },
  { href: "/orders", label: "Orders" },
  { href: "/users", label: "Users" },
  { href: "/comments", label: "Comments" },
  { href: "/contacts", label: "Contacts" },
  { href: "/gallery", label: "Gallery" },
  { href: "/content", label: "Content" },
  { href: "/collab", label: "Collab" },
  { href: "/broadcast", label: "Broadcast" },
  { href: "/audit", label: "Audit" },
] as const;

const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL ?? "https://stiff.ge";

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    if (loading || isLoginRoute) return;
    if (!user) router.replace("/login");
  }, [loading, user, isLoginRoute, router]);

  // The sign-in form is the one page that renders without a session.
  if (isLoginRoute) return <main className="flex-1">{children}</main>;

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <Loading label="Checking session" />
      </main>
    );
  }

  return (
    <>
      <Header />
      <main className="w-full flex-1 px-4 pb-16 sm:px-6">{children}</main>
    </>
  );
}

function Header() {
  const { user, logout, shopEnabled } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  if (!user) return null;

  return (
    <header className="w-full px-4 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
            Admin
          </h1>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {user.username} · {user.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!shopEnabled && (
            /* The kill-switch is easy to leave on by accident, and the shop
               looks fine from in here when it is. */
            <span className="rounded-[2px] border border-subtle px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground">
              Shop hidden
            </span>
          )}
          <a
            href={SHOP_URL}
            rel="noopener noreferrer"
            className={btnGhostSm}
          >
            View shop ↗
          </a>
          <ThemeToggle />
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className={btnGhostSm}
          >
            Log out
          </button>
        </div>
      </div>

      <nav
        aria-label="Admin sections"
        className="-mx-4 mt-8 flex gap-1.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {SECTIONS.map((section) => {
          const active =
            section.href === "/"
              ? pathname === "/"
              : pathname.startsWith(section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active ? "page" : undefined}
              className={`${chipCls(active)} shrink-0`}
            >
              {section.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
