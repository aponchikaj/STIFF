"use client";

import { useEffect, useState } from "react";
import { authApi } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { useSession } from "@/components/providers";
import { Spinner } from "@/components/ui";

export function VerifyClient({ token }: { token: string }) {
  const { refreshUser } = useSession();
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    if (!token) {
      setState("failed");
      setMessage(
        "This link is missing its token. Open the verification link from your email again.",
      );
      return;
    }
    let active = true;
    authApi
      .verifyEmail(token)
      .then(async () => {
        await refreshUser();
        if (!active) return;
        setState("done");
        setMessage("Your email is verified. You can now place orders.");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState("failed");
        setMessage(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [token, refreshUser]);

  return (
    <div className="flex items-start gap-3">
      {state === "working" && <Spinner className="mt-0.5 size-5" />}
      <p aria-live="polite" className="text-sm leading-6 text-muted">
        {message}
      </p>
    </div>
  );
}
