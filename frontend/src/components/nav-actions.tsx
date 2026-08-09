"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "./providers";
import { BagIcon, SearchIcon, UserIcon } from "./icons";
import { SearchOverlay } from "./search-overlay";
import { ThemeToggle } from "./theme-toggle";

const iconLinkCls =
  "relative flex size-10 items-center justify-center rounded-[2px] text-foreground transition-colors hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted";

export function NavActions() {
  const { user, cartCount, unreadCount, shopEnabled } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex items-center">
      <button
        type="button"
        aria-label="Search"
        onClick={() => setSearchOpen(true)}
        className={iconLinkCls}
      >
        <SearchIcon className="size-[18px]" />
      </button>
      {shopEnabled && (
        <Link href="/cart" aria-label="Cart" className={iconLinkCls}>
          <BagIcon className="size-[18px]" />
          {cartCount > 0 && (
            <span className="absolute right-0 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-[2px] bg-foreground px-1 text-[9px] font-bold leading-none text-background">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </Link>
      )}
      <Link
        href={user ? "/account" : "/login"}
        aria-label={user ? "Account" : "Log in"}
        className={iconLinkCls}
      >
        <UserIcon className="size-[18px]" />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread notifications`}
            className="absolute right-1 top-1 size-2 rounded-full bg-foreground"
          />
        )}
      </Link>
      <ThemeToggle />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
