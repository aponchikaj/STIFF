import type { Metadata } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ScrollProgress } from "@/components/motion";
import { Providers } from "@/components/providers";
import { TrackPageview } from "@/components/track-pageview";
import {
  IS_INDEXABLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "STIFF — Essential Clothing from Tbilisi",
    template: "%s — STIFF",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "STIFF",
    "streetwear",
    "Tbilisi",
    "Georgia",
    "clothing brand",
    "heavyweight tees",
    "hoodies",
    "essential clothing",
    "georgian streetwear",
  ],
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "STIFF — Essential Clothing from Tbilisi",
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "STIFF — Essential Clothing from Tbilisi",
    description: SITE_DESCRIPTION,
  },
  robots: IS_INDEXABLE
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

// Light is the default; dark only when the visitor explicitly chose it.
const themeInit = `(function(){try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark");}catch(e){}})();`;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      email: "stiffenter@gmail.com",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Tbilisi",
        addressCountry: "GE",
      },
      sameAs: [
        "https://www.instagram.com/stiff__________/",
        "https://www.tiktok.com/@stiff____",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <head>
        {/* Every product and gallery image is served from Cloudinary — open
            the connection during HTML parse instead of at first <img>. */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        {/* Applies the stored theme before first paint to avoid a flash */}
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>
          <Navbar />
          <ScrollProgress />
          <TrackPageview />
          {/* Fills at least one full screen (minus the h-16 navbar), so the
              footer is only reached by scrolling. */}
          <div className="flex min-h-[calc(100dvh-4rem)] flex-1 flex-col">
            {children}
          </div>
          <Footer />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
