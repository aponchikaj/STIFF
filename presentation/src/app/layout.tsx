import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * Fonts are self-hosted from public/fonts and declared in globals.css — the
 * pixel stand-in needs `size-adjust`, which next/font cannot set. Body type
 * is the system Helvetica, as in the game.
 */
export const metadata: Metadata = {
  title: "STIFF — Operator's Manual",
  description:
    "STIFF is a three-day dare game played on the streets of Tbilisi. The sponsor edition of its manual: how it plays, who plays it, and how a brand gets in.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/Silkscreen-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Silkscreen-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
