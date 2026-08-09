"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { apiFetch } from "@/lib/api";

/** Anonymous traffic beacon: one POST per route change (admin excluded). */
export function TrackPageview() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    let visitorId: string | null = null;
    try {
      visitorId = localStorage.getItem("stiff_vid");
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem("stiff_vid", visitorId);
      }
    } catch {
      return; // storage blocked — don't count this visitor
    }
    apiFetch("/track", {
      method: "POST",
      body: { path: pathname, visitorId },
    }).catch(() => {
      // analytics must never break the page
    });
  }, [pathname]);

  return null;
}
