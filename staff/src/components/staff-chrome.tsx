"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AsteriskMark } from "@/components/asterisk-mark";
import {
  IconChat,
  IconMail,
  IconNotes,
  IconPeople,
  IconRoles,
  IconTasks,
} from "@/components/icons";
import { useStaffSession } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, Loading, btnGhostSm } from "@/components/ui";
import { hasPerm } from "@/lib/api";

const PRIMARY = [
  { href: "/chat", label: "Chat", icon: IconChat },
  { href: "/messages", label: "Direct", icon: IconMail },
  { href: "/tasks", label: "Tasks", icon: IconTasks },
  { href: "/notes", label: "Notes", icon: IconNotes },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sideLink(active: boolean): string {
  return `flex min-h-11 items-center gap-3 rounded-[2px] px-3 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground ${
    active
      ? "bg-foreground text-background"
      : "text-muted hover:text-foreground"
  }`;
}

export function StaffChrome({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useStaffSession();
  const pathname = usePathname();
  const router = useRouter();
  const onLogin = pathname === "/login";
  const [moreOpen, setMoreOpen] = useState(false);
  const canSeePeople =
    hasPerm(user, "people.view") ||
    hasPerm(user, "people.create") ||
    hasPerm(user, "people.assign_role") ||
    hasPerm(user, "people.block");
  const canSeeRoles = hasPerm(user, "roles.manage");

  useEffect(() => {
    if (loading) return;
    if (!user && !onLogin) router.replace("/login");
    if (user && onLogin) router.replace("/chat");
  }, [loading, user, onLogin, router]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loading label="Opening staff" />
      </div>
    );
  }

  if (!user) {
    return <div className="flex min-h-dvh flex-col">{children}</div>;
  }

  const extra = [
    ...(canSeePeople
      ? [{ href: "/people", label: "People", icon: IconPeople }]
      : []),
    ...(canSeeRoles
      ? [{ href: "/roles", label: "Roles", icon: IconRoles }]
      : []),
  ];

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden lg:flex-row">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-subtle bg-background px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
        <Link
          href="/chat"
          className="flex min-h-11 items-center gap-2 rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
        >
          <AsteriskMark className="size-5" />
          <span className="font-display text-lg uppercase leading-none tracking-tight">
            STIFF
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="staff-more"
            className="flex size-11 items-center justify-center rounded-[2px] text-[11px] font-medium uppercase tracking-[0.15em] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
            onClick={() => setMoreOpen((open) => !open)}
          >
            More
          </button>
        </div>
      </header>

      {moreOpen && (
        <div
          id="staff-more"
          className="border-b border-subtle bg-background px-4 py-4 lg:hidden"
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
            {user.username}
            <span className="mt-1 block tracking-[0.2em]">{user.roleName}</span>
          </p>
          <div className="mt-4 flex flex-col gap-1">
            {extra.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={sideLink(isActive(pathname, item.href))}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => void logout()}
              className={`${btnGhostSm} justify-start`}
            >
              Log out
            </button>
          </div>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 flex-col border-r border-subtle px-5 pb-6 pt-[max(2rem,env(safe-area-inset-top))] lg:flex">
        <Link
          href="/chat"
          className="flex min-h-11 items-center gap-2 rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
        >
          <AsteriskMark className="size-5" />
          <span className="font-display text-lg uppercase leading-none tracking-tight">
            STIFF
          </span>
        </Link>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.28em] text-muted">
          Staff
        </p>

        <nav className="mt-10 flex flex-col gap-1" aria-label="Workspace">
          {PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={sideLink(isActive(pathname, item.href))}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {extra.length > 0 && (
          <nav className="mt-8 flex flex-col gap-1" aria-label="Admin">
            <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
              Admin
            </p>
            {extra.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={sideLink(isActive(pathname, item.href))}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="mt-auto flex flex-col gap-4 pt-8">
          <div className="flex items-center gap-3">
            <Avatar name={user.username} size="sm" />
            <p className="min-w-0 text-[11px] uppercase tracking-[0.15em] text-muted">
              <span className="block truncate text-foreground">
                {user.username}
              </span>
              <span className="mt-1 block truncate tracking-[0.2em]">
                {user.roleName}
              </span>
            </p>
          </div>
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void logout()}
              className={btnGhostSm}
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main
        id="main"
        className="flex min-h-0 min-w-0 flex-1 flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0"
      >
        {children}
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-subtle bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {PRIMARY.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground ${
                active ? "text-foreground" : "text-muted"
              }`}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
