"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CollabExperience } from "@/components/collab/collab-experience";
import { COLLAB_PENDING_KEY, getConfig } from "@/lib/api/collab";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,80}$/;

/**
 * Strict mode pulls the secret out of the address bar so a shared URL is
 * already dead. Open mode keeps the token in the URL so the same QR can
 * be opened again and forwarded.
 */
export function TokenStash({ token }: { token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (TOKEN_RE.test(token)) {
      try {
        sessionStorage.setItem(COLLAB_PENDING_KEY, token);
      } catch {
        // storage blocked
      }
    }

    let ignore = false;
    void getConfig()
      .then((config) => {
        if (ignore) return;
        if (config.strictMode) router.replace("/c/keburia");
        else setOpen(true);
      })
      .catch(() => {
        if (!ignore) router.replace("/c/keburia");
      });

    return () => {
      ignore = true;
    };
  }, [token, router]);

  if (open && TOKEN_RE.test(token)) {
    return <CollabExperience initialToken={token} />;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-black">
      <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-white/40">
        Private
      </p>
    </div>
  );
}
