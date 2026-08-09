import type { Metadata } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Providers } from "@/components/providers";
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
  title: "STIFF",
  description: "Essential clothing. Nothing extra.",
};

// Light is the default; dark only when the visitor explicitly chose it.
const themeInit = `(function(){try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the stored theme before first paint to avoid a flash */}
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>
          <Navbar />
          {/* Fills at least one full screen (minus the h-16 navbar), so the
              footer is only reached by scrolling. */}
          <div className="flex min-h-[calc(100svh-4rem)] flex-1 flex-col">
            {children}
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
