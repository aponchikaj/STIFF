"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "./providers";
import { btnSolid, inputCls } from "./ui";

/** Drop-alert capture: guests leave an email and land on registration with
 *  it prefilled; members are already wired into the notification system. */
export function DropSignup() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");

  if (loading) return null;

  if (user) {
    return (
      <p className="mx-auto mt-8 max-w-md text-sm leading-7 text-muted">
        You&apos;re in — drop alerts land straight in your{" "}
        <Link
          href="/notifications"
          className="rounded-[2px] font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
        >
          inbox
        </Link>
        .
      </p>
    );
  }

  return (
    <form
      className="mx-auto mt-8 flex w-full max-w-md flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/register?email=${encodeURIComponent(email.trim())}`);
      }}
    >
      <label htmlFor="drop-email" className="sr-only">
        Email for drop alerts
      </label>
      <input
        id="drop-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        className={`${inputCls} flex-1`}
      />
      <button type="submit" className={`${btnSolid} shrink-0 active:scale-[0.98]`}>
        Notify me
      </button>
    </form>
  );
}
