import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    qualities: [65, 75],
  },

  // Both libraries re-export a large surface. Importing per-module keeps the
  // client bundle to what each component actually pulls in.
  experimental: {
    optimizePackageImports: ["framer-motion", "gsap"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), display-capture=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
