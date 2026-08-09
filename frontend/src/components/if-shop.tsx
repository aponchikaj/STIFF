"use client";

import Link from "next/link";
import { useSession } from "./providers";
import { btnOutline } from "./ui";

/** Renders children only while the admin shop switch is ON. */
export function IfShop({ children }: { children: React.ReactNode }) {
  const { shopEnabled } = useSession();
  if (!shopEnabled) return null;
  return <>{children}</>;
}

/** Renders children only for visitors who are NOT logged in. */
export function IfGuest({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  if (loading || user) return null;
  return <>{children}</>;
}

/** Full-page message shown when the admin has switched the shop off. */
export function ShopClosed() {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
        Shop closed
      </h1>
      <p className="max-w-sm text-sm leading-7 text-muted">
        The shop is taking a breather. Follow us — you&apos;ll know the second
        it reopens.
      </p>
      <Link href="/" className={btnOutline}>
        Back home
      </Link>
    </div>
  );
}
