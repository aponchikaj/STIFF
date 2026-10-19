import type { Metadata, Viewport } from "next";
import { CrtOverlay } from "@/components/crt";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "STIFF",
    template: "%s — STIFF",
  },
  description: "Three days. Three rungs. Hand it in before the clock does.",
  // The game is 16+ and the feed is public; keep it out of kid-safe indexes
  // rather than relying on a gate nobody crawls.
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  // Pure black, so the browser chrome disappears into the page on mobile.
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays on. A pixel face at 12px is small, and disabling zoom
  // to make an app "feel native" is an accessibility failure, not a polish.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* The pixel stand-in is self-hosted (see globals.css for why it
            is not next/font). Preloaded so the title screen does not flash
            in Courier while it arrives. */}
        <link rel="preload" href="/fonts/Silkscreen-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Silkscreen-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="bg-void text-ink antialiased">
        <Providers>
          {children}
          {/* Over everything, pointer-events-none. The whole app is on a
              tube; this is the glass. */}
          <CrtOverlay />
        </Providers>
      </body>
    </html>
  );
}
