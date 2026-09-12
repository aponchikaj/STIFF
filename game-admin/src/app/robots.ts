import type { MetadataRoute } from "next";

/** Nothing on this origin is for the public. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
