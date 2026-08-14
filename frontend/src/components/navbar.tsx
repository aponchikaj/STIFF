import Link from "next/link";
import { AsteriskMark } from "./asterisk-mark";
import { MobileMenu } from "./mobile-menu";
import { NavActions } from "./nav-actions";
import { NavLinks } from "./nav-links";

export function Navbar() {
  return (
    <header className="site-header sticky top-0 z-50 border-b border-subtle bg-background">
      <nav
        aria-label="Main"
        className="flex h-16 w-full items-center justify-between gap-1 px-3 sm:px-6"
      >
        <div className="flex items-center gap-1">
          <MobileMenu />
          <Link
            href="/"
            aria-label="STIFF home"
            className="flex items-center gap-1.5 rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted sm:gap-2"
          >
            <span className="spin-on-hover">
              <AsteriskMark className="size-4 sm:size-6" />
            </span>
            <span className="font-display text-base uppercase leading-none tracking-tight sm:text-xl">
              Stiff
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-2">
          <div className="hidden sm:block">
            <NavLinks />
          </div>
          <NavActions />
        </div>
      </nav>
    </header>
  );
}
