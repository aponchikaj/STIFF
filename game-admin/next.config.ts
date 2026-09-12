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

  // Next writes AGENTS.md and CLAUDE.md into the app on every dev run. The
  // repo already has one CLAUDE.md at the root describing all of it, and a
  // second one here would be loaded as instructions for this directory and
  // contradict it. The sibling admin app does not carry them either.
  agentRules: false,

  experimental: {
    optimizePackageImports: ["framer-motion"],
  },

  // The same first-party /api rewrite the shop panel uses: it keeps the admin
  // session cookie first-party, which survives browsers blocking third-party
  // cookies — and this panel is on stiff.co while the API is on stiff.ge, so
  // without it every request here would be cross-site. Pair with
  // NEXT_PUBLIC_API_URL=/api on the same environment.
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
          // No shared caches, ever: these pages carry players' hand-ins,
          // their reports and the moderation queue.
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
