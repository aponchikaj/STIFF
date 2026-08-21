"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/hooks";
import { btnOutline, Loading } from "@/components/ui";

/**
 * The landing page for a link in an email.
 *
 * The token is spent by a POST from the browser, not by loading the URL.
 * Corporate mail scanners follow every link in a message before it reaches the
 * recipient, and an action that happens on GET is an action those scanners
 * take on the reader's behalf — silently confirming addresses that never
 * clicked, or unsubscribing people who never asked to leave.
 */
export function TokenPage({
  title,
  action,
  success,
  children,
}: {
  title: string;
  action: (token: string) => Promise<{ email: string }>;
  /** Rendered once it worked; gets the address back for the confirmation copy. */
  success: (email: string) => React.ReactNode;
  /** Shown under the outcome, whatever it was. */
  children?: React.ReactNode;
}) {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  // React runs effects twice in development; spending the token twice would
  // make the second attempt fail and show an error for a link that worked.
  const spent = useRef(false);

  useEffect(() => {
    if (spent.current) return;
    spent.current = true;

    if (!token) {
      setError("That link is missing its token. Try the one in the email.");
      setState("failed");
      return;
    }

    void action(token)
      .then((result) => {
        setEmail(result.email);
        setState("done");
      })
      .catch((err: unknown) => {
        setError(errorMessage(err));
        setState("failed");
      });
    // `action` is a fresh closure on every render of the page above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col items-start gap-6 px-4 py-24 sm:px-6">
      <h1 className="text-4xl uppercase tracking-tight sm:text-5xl">{title}</h1>

      {state === "working" && <Loading label="One moment" />}

      {state === "done" && (
        <div className="flex flex-col gap-4">
          {success(email)}
          {children}
        </div>
      )}

      {state === "failed" && (
        <div className="flex flex-col gap-4">
          <p className="max-w-md text-sm leading-7 text-muted">{error}</p>
          {children}
        </div>
      )}

      <Link href="/" className={btnOutline}>
        Back home
      </Link>
    </section>
  );
}
