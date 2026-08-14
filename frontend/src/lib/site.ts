import { HOSTED_BACKEND_URL } from "@/lib/hosted-backend";

/** Accepts only absolute http(s) URLs. Placeholders like "NEXT_PUBLIC_SITE_URL"
 *  fail `new URL()` and must not crash the production build. */
function absoluteHttpUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Canonical site config for SEO. Set NEXT_PUBLIC_SITE_URL per environment:
 *  https://stiff.ge in production, the environment's own URL on staging —
 *  anything that isn't the production URL is kept out of search indexes. */
export const SITE_URL =
  absoluteHttpUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
  absoluteHttpUrl(
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ) ??
  "https://stiff.ge";

export const IS_INDEXABLE = SITE_URL === "https://stiff.ge";

export const SITE_NAME = "STIFF";
export const SITE_DESCRIPTION =
  "STIFF — essential clothing from Tbilisi. Heavy fabric, hard cuts, one mark. Tees, hoodies, pants and accessories made to be worn until they fall apart.";

/** Absolute API base for server-side fetches (metadata, sitemap, JSON-LD).
 *  NEXT_PUBLIC_API_URL may be relative (/api) on deployed frontends, which
 *  only works in the browser — the server needs BACKEND_URL instead. */
export function serverApiBase(): string {
  const backend = absoluteHttpUrl(process.env.BACKEND_URL);
  if (backend) return `${backend}/api`;
  const publicUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (publicUrl.startsWith("http")) {
    return absoluteHttpUrl(publicUrl) ?? publicUrl.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    return `${HOSTED_BACKEND_URL}/api`;
  }
  return "http://localhost:4000/api";
}
