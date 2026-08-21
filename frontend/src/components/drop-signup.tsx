"use client";

import Link from "next/link";
import { useState } from "react";
import { subscribersApi } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { useSession } from "./providers";
import { btnSolid, inputCls } from "./ui";

/**
 * Drop alerts.
 *
 * This used to push guests at the registration page with their address
 * pre-filled, which asks somebody who wants one email a season to pick a
 * password and accept an account. Most of them do not, and the address is lost
 * — so the thing being built here is the list, not the user table.
 *
 * Signed-in members are already wired into notifications and see that instead.
 */
export function DropSignup({
  source = "home",
}: {
  source?: "home" | "footer" | "checkout";
}) {
  const { user, loading } = useSession();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (sent) {
    return (
      <div className="mx-auto mt-8 max-w-md border border-subtle p-5">
        <p className="text-sm font-medium">Check your inbox.</p>
        <p className="mt-2 text-sm leading-7 text-muted">
          {/* Named plainly, because "check your inbox" without saying why is
              how a confirmation email ends up ignored and the signup wasted. */}
          There&apos;s one link to click. Until you do, we won&apos;t send you
          anything — that&apos;s the point of it.
        </p>
      </div>
    );
  }

  return (
    <form
      className="mx-auto mt-8 flex w-full max-w-md flex-col gap-2 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await subscribersApi.subscribe(email.trim(), source);
          setSent(true);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex-1">
        <label htmlFor={`drop-email-${source}`} className="sr-only">
          Email for drop alerts
        </label>
        <input
          id={`drop-email-${source}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={error ? true : undefined}
          className={`${inputCls} w-full`}
        />
        {error && (
          <p role="alert" className="mt-2 text-left text-xs text-muted">
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={busy}
        className={`${btnSolid} shrink-0 active:scale-[0.98]`}
      >
        {busy ? "Sending…" : "Notify me"}
      </button>
    </form>
  );
}
