import { NextRequest, NextResponse } from "next/server";

/**
 * Staging gate: when STAGING_USER + STAGING_PASSWORD are set on a
 * deployment (stage.stiff.ge, pre-prod.stiff.ge), every request must
 * pass HTTP Basic Auth. Leave the vars unset in production and local
 * dev and the middleware is a no-op.
 */
export function middleware(request: NextRequest) {
  const user = process.env.STAGING_USER;
  const password = process.env.STAGING_PASSWORD;
  if (!user || !password) return NextResponse.next();

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const [givenUser, givenPassword] = atob(header.slice(6)).split(":");
      if (givenUser === user && givenPassword === password) {
        return NextResponse.next();
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
