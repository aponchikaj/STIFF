"use client";

import Link from "next/link";
import { useSession } from "./providers";

const LINKS = [
  { label: "Clothing", href: "/clothing", shop: true },
  { label: "Gallery", href: "/gallery", shop: false },
  { label: "About", href: "/about", shop: false },
  { label: "Contact", href: "/contact", shop: false },
];

export function NavLinks() {
  const { shopEnabled } = useSession();
  const links = LINKS.filter((l) => !l.shop || shopEnabled);

  return (
    <ul className="flex items-center">
      {links.map(({ label, href }) => (
        <li key={href}>
          <Link
            href={href}
            className="flex h-10 items-center rounded-[2px] px-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted sm:px-3 sm:text-xs sm:tracking-[0.2em]"
          >
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
