"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authApi } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { btnSolid, Field, inputCls } from "@/components/ui";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!token) {
    return (
      <p className="text-sm leading-6 text-muted">
        This link is missing its token. Open the reset link from your email
        again, or request a new one.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(
      new FormData(e.currentTarget).get("password") ?? "",
    );
    setBusy(true);
    setStatus(null);
    try {
      await authApi.resetPassword(token, password);
      setStatus("Password updated. Taking you to log in…");
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      setStatus(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field id="reset-password" label="New password">
        <input
          id="reset-password"
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
        {busy ? "Saving…" : "Set new password"}
      </button>
      <p aria-live="polite" className="min-h-5 text-xs text-muted">
        {status}
      </p>
    </form>
  );
}
