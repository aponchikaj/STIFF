"use client";

import Link from "next/link";
import { subscribersApi } from "@/lib/api";
import { TokenPage } from "../token-page";

export function ConfirmView() {
  return (
    <TokenPage
      title="You're on the list"
      action={(token) => subscribersApi.confirm(token)}
      success={(email) => (
        <p className="max-w-md text-sm leading-7 text-muted">
          {email} is confirmed. We&apos;ll email when a drop lands — small runs,
          so it will not be often, and every message has one-click unsubscribe
          at the bottom.
        </p>
      )}
    >
      <p className="max-w-md text-sm leading-7 text-muted">
        Want the rest — order tracking, saved pieces, the comments?{" "}
        <Link
          href="/register"
          className="rounded-[2px] font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
        >
          Make an account
        </Link>
        . Not required for drop alerts.
      </p>
    </TokenPage>
  );
}
