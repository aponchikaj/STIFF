import Link from "next/link";
import { AsteriskMark } from "./asterisk-mark";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { label: "Clothing", href: "/clothing" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function Navbar() {
  return (
    <header className="site-header sticky top-0 z-50 border-b border-subtle bg-background/90 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"
      >
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
        <div className="flex items-center gap-0.5 sm:gap-2">
          <ul className="flex items-center gap-0.5 sm:gap-2">
            {links.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex h-10 items-center rounded-[2px] px-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted sm:px-3.5 sm:text-xs sm:tracking-[0.2em]"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
