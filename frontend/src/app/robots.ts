import type { MetadataRoute } from "next";
import { IS_INDEXABLE, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Staging and preview environments must never be indexed.
  if (!IS_INDEXABLE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/account",
        "/cart",
        "/settings",
        "/notifications",
        "/login",
        "/register",
        "/verify-email",
        "/reset-password",
        "/forgot-password",
        "/search",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
