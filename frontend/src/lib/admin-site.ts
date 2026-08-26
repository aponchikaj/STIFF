/**
 * Where the admin panel lives.
 *
 * The panel is its own deployment on its own origin (admin.stiff.ge) with its
 * own sign-in, so everything the shop knows about it is this one URL. Set
 * `NEXT_PUBLIC_ADMIN_URL` per environment; the defaults cover local
 * development and production without configuration.
 */

/** Accepts absolute http(s) URLs, including localhost during development. */
function adminOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Placeholders like "NEXT_PUBLIC_ADMIN_URL" parse as nothing useful;
    // a real host is either dotted or localhost.
    if (!url.hostname.includes(".") && url.hostname !== "localhost") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export const ADMIN_URL =
  adminOrigin(process.env.NEXT_PUBLIC_ADMIN_URL) ??
  (process.env.NODE_ENV === "production"
    ? "https://admin.stiff.ge"
    : "http://localhost:3002");
