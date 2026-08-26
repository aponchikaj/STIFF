/**
 * Where the *shop* lives — not this panel.
 *
 * Two things need it, and one of them is expensive to get wrong. Collab QR
 * codes are minted from an origin and then **printed**, so if the panel sends
 * its own origin the codes come out pointing at admin.stiff.ge/c/… , which
 * serves no such route. That was fine while the panel lived inside the shop
 * and `window.location.origin` was the shop; it stopped being true the moment
 * the panel moved to its own site.
 *
 * Set `NEXT_PUBLIC_SHOP_URL` per environment so staging mints staging codes.
 */
function shopOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export const SHOP_URL =
  shopOrigin(process.env.NEXT_PUBLIC_SHOP_URL) ??
  (process.env.NODE_ENV === "production"
    ? "https://stiff.ge"
    : "http://localhost:3000");
