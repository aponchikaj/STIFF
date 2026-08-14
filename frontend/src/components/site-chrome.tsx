"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./footer";
import { Navbar } from "./navbar";
import { TrackPageview } from "./track-pageview";

/**
 * Site chrome is hidden on /c/* so the collab film is a sealed viewing
 * room: no nav, no footer, no share sheet, no traffic beacon with a token.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const privateView = pathname === "/c" || pathname.startsWith("/c/");

  if (privateView) {
    return (
      <div className="flex min-h-dvh flex-1 flex-col bg-black text-white">
        {children}
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div
        aria-hidden="true"
        className="scroll-progress pointer-events-none fixed inset-x-0 top-16 z-40 h-0.5 bg-foreground"
      />
      <TrackPageview />
      <div className="flex min-h-[calc(100dvh-4rem)] flex-1 flex-col">
        {children}
      </div>
      <Footer />
    </>
  );
}
