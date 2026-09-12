"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AsteriskMark } from "@/components/asterisk-mark";
import { useSession } from "@/components/providers";
import { btnPrimary, Field, inputCls, labelCls } from "@/components/ui";
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
    <div className="w-full max-w-[380px]">
      {/* Which panel this is, before anything is typed. The two look alike
          and share one set of credentials, so the only thing that stops a
          tired operator signing into the wrong one is saying so here. */}
      <div className="mb-8 flex items-center gap-2.5">
        <AsteriskMark className="size-4 text-ink" />
        <span className="font-display text-[15px] tracking-[-0.01em]">
          STIFF
        </span>
        <span className="ml-auto rounded-[var(--radius-pill)] border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
          admin.stiff.co
        </span>
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-card p-7 shadow-[var(--shadow-raised)]">
        <h1 className="font-display text-[26px] leading-none">Game admin</h1>
        <p className="mt-2.5 text-[12px] leading-5 text-muted">Seasons, hand-ins, players and the board.</p>

        <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
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

          {/* One message for every rejection — wrong password, no such
              account, not an admin. Saying which would confirm the other half
              to anyone working through the shop's user list. */}
          {error && (
            <p
              role="alert"
              className="rounded-[var(--radius-control)] border border-danger/25 bg-danger-tint px-3 py-2 text-[12px] leading-5 text-danger"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`${btnPrimary} mt-1 w-full`}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <p className={`${labelCls} mt-5 text-center normal-case tracking-normal`}>
        The same account as the shop panel. Sessions are separate.
      </p>
    </div>
  );
}
