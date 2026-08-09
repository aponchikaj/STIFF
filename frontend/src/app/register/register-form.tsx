"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authApi } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { useSession } from "@/components/providers";
import { btnSolid, Field, inputCls } from "@/components/ui";

export function RegisterForm({ defaultEmail = "" }: { defaultEmail?: string }) {
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
      const { user } = await authApi.register({
        username: String(data.get("username") ?? ""),
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      setUser(user);
      router.push("/account");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field id="reg-username" label="Username">
        <input
          id="reg-username"
          name="username"
          type="text"
          required
          minLength={3}
          maxLength={24}
          pattern="[a-zA-Z0-9_]+"
          title="Letters, numbers and underscores only"
          autoComplete="username"
          placeholder="yourname"
          className={inputCls}
        />
      </Field>
      <Field id="reg-email" label="Email">
        <input
          id="reg-email"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          autoComplete="email"
          placeholder="you@example.com"
          className={inputCls}
        />
      </Field>
      <Field id="reg-password" label="Password">
        <input
          id="reg-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Min. 8 characters"
          className={inputCls}
        />
      </Field>
      <button type="submit" disabled={busy} className={btnSolid}>
        {busy ? "Creating account…" : "Create account"}
      </button>
      <p aria-live="polite" role="alert" className="min-h-5 text-xs text-muted">
        {error}
      </p>
    </form>
  );
}
