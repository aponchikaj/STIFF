import type { Metadata, Viewport } from "next";
import {
  Archivo,
  Archivo_Black,
  Chakra_Petch,
  IBM_Plex_Mono,
} from "next/font/google";
import "./globals.css";

/**
 * Two type worlds, one deck.
 *
 * The shop's superfamily — Archivo Black for display, Archivo for everything
 * else — carries the STIFF chapters (brand.md). The game's chapter switches to
 * the game's own faces from its design spec: Chakra Petch for display and IBM Plex
 * Mono for labels and data. Body copy stays in Archivo throughout so the deck
 * loads four families, not five.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const chakra = Chakra_Petch({
  variable: "--font-chakra",
  weight: "700",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "STIFF — Investor deck",
  description:
    "STIFF, a Tbilisi clothing brand: the shop at stiff.ge, and the three-day game at stiff.co built to fill it.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoBlack.variable} ${chakra.variable} ${plexMono.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
