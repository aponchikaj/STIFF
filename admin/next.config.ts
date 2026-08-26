import type { NextConfig } from "next";
import { HOSTED_BACKEND_URL } from "./src/lib/hosted-backend";

function backendOrigin(): string | undefined {
  const raw = process.env.BACKEND_URL?.trim();
  if (raw) {
    try {
      const url = new URL(raw);
      if (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.hostname.includes(".")
      ) {
        return url.origin;
      }
    } catch {
      // Placeholder values like "BACKEND_URL" are not origins.
    }
  }
  if (process.env.NODE_ENV === "production") return HOSTED_BACKEND_URL;
  return undefined;
}

const nextConfig: NextConfig = {
  poweredByHeader: false,

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    qualities: [65, 75],
  },

  experimental: {
    optimizePackageImports: ["framer-motion"],
  },

  // Same first-party /api rewrite the shop uses: it keeps the admin session
  // cookie first-party, which survives browsers blocking third-party cookies.
  // Pair with NEXT_PUBLIC_API_URL=/api on the same environment.
  async rewrites() {
    const backend = backendOrigin();
    if (!backend) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backend}/uploads/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Content-Security-Policy is set per-request in `src/proxy.ts`,
          // because it carries a fresh nonce every time.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), display-capture=(), geolocation=()",
          },
          // Belt and braces with robots.ts — nothing here should ever be
          // indexed, and a stray crawler does not read robots.txt first.
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          // No shared caches, ever: these pages are one person's view of every
          // order in the shop.
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
