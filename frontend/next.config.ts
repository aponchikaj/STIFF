import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

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
    const backend = process.env.BACKEND_URL;
    if (!backend) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backend.replace(/\/$/, "")}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backend.replace(/\/$/, "")}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
