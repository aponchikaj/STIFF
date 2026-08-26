import { NextResponse, type NextRequest } from "next/server";
import { HOSTED_BACKEND_URL } from "@/lib/hosted-backend";

/**
 * Sets the Content-Security-Policy, with a fresh nonce per request.
 *
 * A nonce rather than a hash list, because Next emits several inline scripts of
 * its own (the hydration payload, the request id) whose contents change build
 * to build — pinning them by hash breaks the app on the next release, which is
 * exactly what a hash-only policy did here first time round. Next reads the
 * nonce out of this header during render and puts it on its own scripts.
 *
 * The other security headers stay in `next.config.ts`; only the CSP has to be
 * per-request.
 */

/** Mirrors `backendOrigin()` in next.config.ts — /api is proxied in production. */
function backendOrigin(): string {
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
  // Development talks to Nest directly on another port, which is a separate
  // origin as far as connect-src is concerned.
  return "http://localhost:4000";
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced bootstrap load the rest of the bundle
    // without every chunk needing its own nonce. React needs eval in
    // development only, to rebuild server stacks in the browser.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Tailwind and Next both inject style tags that carry no nonce, so this is
    // the one directive that cannot be tightened without breaking rendering.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://res.cloudinary.com",
    "media-src 'self' blob: https://res.cloudinary.com",
    "font-src 'self' data:",
    `connect-src 'self' ${backendOrigin()} https://res.cloudinary.com`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Static assets and the API proxy need no policy of their own, and
    // prefetches are not documents.
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
