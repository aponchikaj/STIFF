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
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
  async rewrites() {
    const backend = backendOrigin();
    if (!backend) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), display-capture=(), geolocation=()",
          },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
