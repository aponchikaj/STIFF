import type { NextConfig } from "next";

/**
 * The game runs on its own origin and talks to the same Nest API the shop
 * does. Two things follow and both are handled here.
 *
 * **Cookies.** The API is on stiff.ge; the game is not. Different
 * registrable domains make every call cross-site, and browsers are
 * increasingly blunt about third-party cookies. So in any environment with
 * `BACKEND_URL` set we rewrite `/api/*` through this origin — the session
 * cookie is then first-party and survives. Pair it with
 * `NEXT_PUBLIC_API_URL=/api` in the same environment. The client also keeps
 * a Bearer-token fallback for the case where even that is not enough.
 *
 * **Media.** Hand-ins live in object storage, not here, so `images.
 * remotePatterns` has to name those hosts. The icon set is local and is
 * served `unoptimized` on purpose — see `src/components/icon.tsx`.
 */

function backendOrigin(): string | undefined {
  const raw = process.env.BACKEND_URL?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    // Guard against a placeholder literally set to "BACKEND_URL", which
    // would otherwise produce a rewrite to a nonexistent host and a 502
    // that looks like the API is down.
    if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".")) {
      return url.origin;
    }
  } catch {
    /* not a URL */
  }
  return undefined;
}

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // Dev only: lets a phone on the same Wi-Fi load the dev server's assets
  // at the Mac's LAN address (http://192.168.x.y:3003). Next blocks dev
  // resources requested from any hostname but localhost unless named here.
  // Private ranges only, as whole labels — the matcher has no partial
  // wildcards. Has no effect on a production build.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.stiff.ge" },
      { protocol: "https", hostname: "**.stiff.co" },
    ],
  },

  experimental: {
    // Each of these re-exports a large surface; per-module imports keep the
    // client bundle to what a screen actually uses. Matters more here than
    // on the shop — this app pulls in several animation runtimes.
    optimizePackageImports: [
      "framer-motion",
      "motion",
      "@react-spring/web",
      "lucide-react",
      "date-fns",
    ],
  },

  async rewrites() {
    const backend = backendOrigin();
    if (!backend) return [];
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/uploads/:path*", destination: `${backend}/uploads/:path*` },
    ];
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
            // The hand-in flow needs the camera and the microphone. Nothing
            // else is granted, and geolocation is refused outright — a game
            // about doing things in public must not be able to say where.
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), display-capture=(), geolocation=()",
          },
        ],
      },
      {
        // The icon set is immutable and content-addressed by name.
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
