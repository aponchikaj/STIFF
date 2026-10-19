import type { NextConfig } from "next";

/**
 * The journal is one static page, so it is exported to `out/` and served
 * from a Cloudflare Worker's static assets (wrangler.jsonc) — nothing runs
 * on a server. Response headers live in public/_headers, because an export
 * has no server to apply `headers()`.
 */
const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,

  // Both libraries re-export a large surface. Importing per-module keeps the
  // client bundle to what each component actually pulls in.
  experimental: {
    optimizePackageImports: ["framer-motion", "gsap"],
  },
};

export default nextConfig;
