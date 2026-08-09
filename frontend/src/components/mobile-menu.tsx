"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AsteriskMark } from "./asterisk-mark";
import { MenuIcon, XIcon } from "./icons";
import { useSession } from "./providers";

const EASE = [0.16, 1, 0.3, 1] as const;

export function MobileMenu() {
  const { user, shopEnabled, cartCount, unreadCount } = useSession();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const mainLinks = [
    ...(shopEnabled ? [{ label: "Clothing", href: "/clothing" }] : []),
    { label: "Gallery", href: "/gallery" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];

  const accountLinks = [
    ...(shopEnabled
      ? [
          {
            label: `Cart${cartCount > 0 ? ` (${cartCount})` : ""}`,
            href: "/cart",
          },
        ]
      : []),
    user
      ? {
          label: `Account${unreadCount > 0 ? ` (${unreadCount})` : ""}`,
          href: "/account",
        }
      : { label: "Log in", href: "/login" },
    ...(user ? [{ label: "Settings", href: "/settings" }] : []),
    ...(user?.role === "admin" ? [{ label: "Admin", href: "/admin" }] : []),
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex size-10 items-center justify-center rounded-[2px] text-foreground transition-colors hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted sm:hidden"
      >
        <MenuIcon className="size-5" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[70] bg-foreground/40 sm:hidden"
            />
            <motion.nav
              aria-label="Mobile"
              initial={reduce ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={reduce ? undefined : { x: "-100%" }}
              transition={{ duration: 0.35, ease: EASE }}
              className="fixed inset-y-0 left-0 z-[80] flex w-[80%] max-w-sm flex-col border-r border-foreground bg-background sm:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b border-subtle px-4">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                >
                  <AsteriskMark className="size-4" />
                  <span className="font-display text-base uppercase leading-none tracking-tight">
                    Stiff
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="flex size-10 items-center justify-center rounded-[2px] text-foreground transition-colors hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                >
                  <XIcon className="size-5" />
                </button>
              </div>

              <ul className="flex flex-col px-4 py-6">
                {mainLinks.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className="block rounded-[2px] py-3 font-display text-3xl uppercase leading-none tracking-tight transition-colors hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>

              <ul className="mt-auto flex flex-col gap-1 border-t border-subtle px-4 py-6">
                {accountLinks.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className="block rounded-[2px] py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
