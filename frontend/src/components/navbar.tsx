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
    <header className="sticky top-0 z-50 border-b border-subtle bg-background/90 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"
      >
        <Link
          href="/"
          aria-label="STIFF home"
          className="flex items-center gap-2 rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
        >
          <span className="spin-on-hover">
            <AsteriskMark className="size-5 sm:size-6" />
          </span>
          <span className="font-display text-lg uppercase leading-none tracking-tight sm:text-xl">
            Stiff
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <ul className="flex items-center gap-1 sm:gap-2">
            {links.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex h-10 items-center rounded-[2px] px-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted sm:px-3.5 sm:text-xs"
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
