"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AsteriskMark } from "@/components/asterisk-mark";
import { useStaffSession } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loading, btnGhostSm } from "@/components/ui";

const NAV = [
  { href: "/chat", label: "Chat" },
  { href: "/messages", label: "Messages" },
  { href: "/tasks", label: "Tasks" },
  { href: "/notes", label: "Notes" },
] as const;

function navCls(active: boolean): string {
  return `rounded-[2px] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.2em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
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
  const canManage = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    if (loading) return;
    if (!user && !onLogin) router.replace("/login");
    if (user && onLogin) router.replace("/chat");
  }, [loading, user, onLogin, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loading label="Staff" />
      </div>
    );
  }

  if (!user) {
    return <div className="flex min-h-dvh flex-col">{children}</div>;
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex items-center justify-between border-b border-subtle px-4 py-3 md:w-56 md:flex-col md:items-stretch md:justify-start md:border-b-0 md:border-r md:px-5 md:py-8">
        <Link
          href="/chat"
          className="flex items-center gap-2 rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
        >
          <AsteriskMark className="size-5" />
          <span className="font-display text-lg uppercase leading-none tracking-tight">
            STIFF
          </span>
        </Link>
        <p className="hidden text-[10px] font-medium uppercase tracking-[0.28em] text-muted md:mt-2 md:block">
          Staff
        </p>

        <nav className="hidden flex-col gap-1 md:mt-10 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={navCls(pathname === item.href || pathname.startsWith(`${item.href}/`))}
            >
              {item.label}
            </Link>
          ))}
          {canManage && (
            <Link href="/people" className={navCls(pathname === "/people")}>
              People
            </Link>
          )}
        </nav>

        <div className="hidden md:mt-auto md:flex md:flex-col md:gap-4">
          <p className="text-[11px] uppercase tracking-[0.15em] text-muted">
            {user.username}
            <span className="mt-1 block text-[10px] tracking-[0.2em]">
              {user.role}
            </span>
          </p>
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <button type="button" onClick={() => void logout()} className={btnGhostSm}>
              Log out
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button type="button" onClick={() => void logout()} className={btnGhostSm}>
            Log out
          </button>
        </div>
      </aside>

      <nav className="flex gap-1 overflow-x-auto border-b border-subtle px-3 py-2 md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={navCls(pathname === item.href || pathname.startsWith(`${item.href}/`))}
          >
            {item.label}
          </Link>
        ))}
        {canManage && (
          <Link href="/people" className={navCls(pathname === "/people")}>
            People
          </Link>
        )}
      </nav>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
