import Link from "next/link";
import { AsteriskMark } from "./asterisk-mark";

const links = [
  { label: "Clothing", href: "/clothing" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"
      >
        <Link
          href="/"
          aria-label="STIFF home"
          className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <AsteriskMark className="size-5 sm:size-6" />
          <span className="text-lg uppercase leading-none tracking-tight sm:text-xl">
            Stiff
          </span>
        </Link>
        <ul className="flex items-center gap-1 sm:gap-2">
          {links.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-10 items-center rounded-sm px-2.5 text-[11px] uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 sm:px-3.5 sm:text-xs"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
