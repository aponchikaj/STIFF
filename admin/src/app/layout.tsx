import type { Metadata } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import { headers } from "next/headers";
import { AdminChrome } from "@/components/admin-chrome";
import { Providers } from "@/components/providers";
import { THEME_INIT } from "@/lib/theme-init";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "STIFF Admin",
    template: "%s — STIFF Admin",
  },
  description: "Internal shop administration for STIFF.",
  // Nothing on this origin belongs in a search index. `robots.ts` and the
  // X-Robots-Tag header say the same thing; a crawler only has to honour one.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Every page here is rendered per-request. That is what lets the CSP nonce in
 * `src/proxy.ts` reach Next's inline scripts — and it is the right default
 * anyway, since nothing behind this sign-in should be prerendered or cached.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        {/* Applies the stored theme before first paint to avoid a flash.
            Carries the request's CSP nonce, the same way Next's own inline
            scripts do. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>
          <AdminChrome>{children}</AdminChrome>
        </Providers>
      </body>
    </html>
  );
}
