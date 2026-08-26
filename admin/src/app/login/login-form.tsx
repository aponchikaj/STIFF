"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AsteriskMark } from "@/components/asterisk-mark";
import { useSession } from "@/components/providers";
import { btnSolid, Field, inputCls } from "@/components/ui";
import { errorMessage } from "@/lib/hooks";

export function LoginForm() {
  const { user, loading, login } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Someone who still has a session should not be looking at a sign-in form.
  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await login({
        emailOrUsername: String(form.get("emailOrUsername") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <AsteriskMark className="size-8 text-foreground" />
      <h1 className="mt-8 text-4xl uppercase tracking-tight">Admin</h1>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
        Staff of one. Sign in to continue.
      </p>

      <form onSubmit={submit} className="mt-10 flex flex-col gap-5">
        <Field id="emailOrUsername" label="Email or username">
          <input
            id="emailOrUsername"
            name="emailOrUsername"
            autoComplete="username"
            required
            autoFocus
            className={inputCls}
          />
        </Field>
        <Field id="password" label="Password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputCls}
          />
        </Field>

        {/* One message for every rejection — wrong password, no such account,
            not an admin. Saying which would confirm the other half to anyone
            working through the shop's user list. */}
        <p aria-live="polite" className="min-h-4 text-xs text-muted">
          {error}
        </p>

        <button type="submit" disabled={busy} className={btnSolid}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
