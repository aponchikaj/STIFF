/**
 * Sanitises a `?next=` destination.
 *
 * A bare `startsWith("/")` check is not enough: `//evil.com` also starts with
 * a slash, and every browser reads it as a protocol-relative absolute URL. So
 * a login link could be crafted to bounce someone straight off the site,
 * carrying whatever trust the STIFF domain earned. Backslashes get the same
 * treatment because some parsers normalise them to slashes.
 */
export function safeNext(
  value: unknown,
  fallback: string = "/account",
): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/")) return fallback;
  // "//host" and "/\host" are both absolute once a browser is done with them.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
