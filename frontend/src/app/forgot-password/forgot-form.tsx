"use client";

import { useState } from "react";
import { authApi } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { btnSolid, Field, inputCls } from "@/components/ui";

export function ForgotForm() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    setBusy(true);
    setStatus(null);
    try {
      await authApi.forgotPassword(email);
      setStatus(
        "If that email has an account, a reset link is on its way. Check your inbox.",
      );
    } catch (err) {
      setStatus(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <p className="text-sm leading-6 text-muted">
        Enter the email you registered with and we&apos;ll send you a link to
        set a new password.
      </p>
      <Field id="forgot-email" label="Email">
        <input
          id="forgot-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputCls}
        />
      </Field>
      <button type="submit" disabled={busy} className={btnSolid}>
        {busy ? "Sending…" : "Send reset link"}
      </button>
      <p aria-live="polite" className="min-h-5 text-xs text-muted">
        {status}
      </p>
    </form>
  );
}
