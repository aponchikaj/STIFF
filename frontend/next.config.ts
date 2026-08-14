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

  // framer-motion re-exports a large surface; importing per-module keeps the
  // client bundle to what each component actually uses.
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },

  // When BACKEND_URL is set (deployed environments), the frontend proxies
  // /api/* to the backend on its own domain. Auth cookies then stay
  // first-party, which survives browsers' third-party-cookie blocking.
  // Pair it with NEXT_PUBLIC_API_URL=/api on the same environment.
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
        source: "/c/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), display-capture=(), geolocation=()",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
