import Link from "next/link";
import { BackToTop } from "./back-to-top";
import { SocialLinks } from "./social-links";

const links = [
  { label: "Clothing", href: "/clothing" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Rules", href: "/rules" },
];

export function Footer() {
  return (
    <footer className="border-t border-subtle">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-8 sm:px-6">
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {links.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="rounded-[2px] text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <SocialLinks labels={false} />
          <BackToTop />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          © 2026 STIFF
        </p>
      </div>
      <div aria-hidden="true" className="select-none overflow-hidden">
        <p className="font-display -mb-[3.5vw] text-center text-[19vw] uppercase leading-[0.8] tracking-tight">
          Stiff
        </p>
      </div>
    </footer>
  );
}
