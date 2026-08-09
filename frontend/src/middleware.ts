import { NextRequest, NextResponse } from "next/server";

/**
 * Staging gate: when STAGING_USER + STAGING_PASSWORD are set on a
 * deployment (stage.stiff.ge, pre-prod.stiff.ge), the first request must
 * pass HTTP Basic Auth; success drops a session cookie so client-side
 * navigations and API calls aren't re-challenged. Production and local
 * dev leave the vars unset and the middleware is a no-op.
 */

const AUTH_COOKIE = "stiff_staging_auth";

async function expectedToken(user: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${user}:${password}:stiff-gate`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const user = process.env.STAGING_USER;
  const password = process.env.STAGING_PASSWORD;
  if (!user || !password) return NextResponse.next();

  const token = await expectedToken(user, password);

  // Already authenticated this browser — let everything through.
  if (request.cookies.get(AUTH_COOKIE)?.value === token) {
    return NextResponse.next();
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const [givenUser, givenPassword] = atob(header.slice(6)).split(":");
      if (givenUser === user && givenPassword === password) {
        const response = NextResponse.next();
        response.cookies.set(AUTH_COOKIE, token, {
          httpOnly: true,
          sameSite: "lax",
          secure: request.nextUrl.protocol === "https:",
          maxAge: 60 * 60 * 24 * 7, // one login per browser per week
          path: "/",
        });
        return response;
      }
    } catch {
      // malformed header — fall through to the 401
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="STIFF staging"' },
  });
}

export const config = {
  // Protect everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
