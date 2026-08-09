"use client";

import Link from "next/link";
import { AsteriskMark } from "./asterisk-mark";
import { BackToTop } from "./back-to-top";
import { useSession } from "./providers";
import { SocialLinks } from "./social-links";

const groups = [
  {
    heading: "Shop",
    links: [
      { label: "Clothing", href: "/clothing", shop: true },
      { label: "Cart", href: "/cart", shop: true },
      { label: "My account", href: "/account" },
    ],
  },
  {
    heading: "Brand",
    links: [
      { label: "Gallery", href: "/gallery" },
      { label: "About", href: "/about" },
      { label: "Rules", href: "/rules" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "Notifications", href: "/notifications" },
      { label: "Settings", href: "/settings" },
    ],
  },
];

const footerLink =
  "inline-block rounded-[2px] py-1 text-sm text-foreground transition-colors hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted";

export function Footer() {
  const { shopEnabled } = useSession();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      links: group.links.filter(
        (l) => !("shop" in l && l.shop) || shopEnabled,
      ),
    }))
    .filter((group) => group.links.length > 0);

  return (
    <footer className="border-t border-subtle">
      <div className="grid w-full gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="flex flex-col gap-4">
          <Link
            href="/"
            aria-label="STIFF home"
            className="flex items-center gap-2 self-start rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            <AsteriskMark className="size-5" />
            <span className="font-display text-lg uppercase leading-none tracking-tight">
              Stiff
            </span>
          </Link>
          <p className="max-w-[16rem] text-xs leading-6 text-muted">
            Essential clothing. Nothing extra. Designed and worn in Tbilisi
            first.
          </p>
          <SocialLinks labels={false} />
        </div>

        {visibleGroups.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              {group.heading}
            </p>
            <ul className="mt-4 flex flex-col gap-1.5">
              {group.links.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className={footerLink}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-subtle">
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-5 sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            © 2026 STIFF — All rights reserved
          </p>
          <p className="hidden text-[10px] font-medium uppercase tracking-[0.25em] text-muted sm:block">
            [ 41.7151° N, 44.8271° E — Tbilisi ]
          </p>
          <BackToTop />
        </div>
      </div>
    </footer>
  );
}
