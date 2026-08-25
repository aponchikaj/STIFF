"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authApi } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { useSession } from "@/components/providers";
import { btnSolid, Field, inputCls } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const { setUser } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { user } = await authApi.login({
        emailOrUsername: String(data.get("emailOrUsername") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      setUser(user);
      router.push(next);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field id="login-id" label="Email or username">
        <input
          id="login-id"
          name="emailOrUsername"
          type="text"
          required
          autoComplete="username"
          placeholder="you@example.com"
          className={inputCls}
        />
      </Field>
      <Field id="login-password" label="Password">
        <input
          id="login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className={inputCls}
        />
      </Field>
      <button type="submit" disabled={busy} className={btnSolid}>
        {busy ? "Logging in…" : "Log in"}
      </button>
      <p aria-live="polite" role="alert" className="min-h-5 text-xs text-muted">
        {error}
      </p>
    </form>
  );
}
