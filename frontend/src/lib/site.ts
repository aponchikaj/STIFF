/** Canonical site config for SEO. Set NEXT_PUBLIC_SITE_URL per environment:
 *  https://stiff.ge in production, the environment's own URL on staging —
 *  anything that isn't the production URL is kept out of search indexes. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://stiff.ge";

export const IS_INDEXABLE = SITE_URL === "https://stiff.ge";

export const SITE_NAME = "STIFF";
export const SITE_DESCRIPTION =
  "STIFF — essential clothing from Tbilisi. Heavy fabric, hard cuts, one mark. Tees, hoodies, pants and accessories made to be worn until they fall apart.";

/** Absolute API base for server-side fetches (metadata, sitemap, JSON-LD).
 *  NEXT_PUBLIC_API_URL may be relative (/api) on deployed frontends, which
 *  only works in the browser — the server needs BACKEND_URL instead. */
export function serverApiBase(): string {
  const backend = process.env.BACKEND_URL;
  if (backend) return `${backend.replace(/\/$/, "")}/api`;
  const publicUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (publicUrl.startsWith("http")) return publicUrl;
  return "http://localhost:4000/api";
}
