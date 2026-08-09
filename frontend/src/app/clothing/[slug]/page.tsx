import type { Metadata } from "next";
import type { Product } from "@/lib/api";
import { serverApiBase, SITE_URL } from "@/lib/site";
import { ProductView } from "./product-view";

async function fetchProduct(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(
      `${serverApiBase()}/products/${encodeURIComponent(slug)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as Product;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/clothing/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProduct(slug);
  if (!product) return { title: "Clothing" };

  const description =
    product.description?.slice(0, 155) ||
    `${product.name} — from the STIFF drop. Essential clothing designed in Tbilisi.`;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/clothing/${product.slug}` },
    openGraph: {
      title: `${product.name} — STIFF`,
      description,
      url: `${SITE_URL}/clothing/${product.slug}`,
      images: product.images[0] ? [{ url: product.images[0] }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/clothing/[slug]">) {
  const { slug } = await params;
  // Deduped with generateMetadata's call by Next's fetch cache.
  const product = await fetchProduct(slug);

  const jsonLd = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description || undefined,
        image: product.images.length > 0 ? product.images : undefined,
        url: `${SITE_URL}/clothing/${product.slug}`,
        brand: { "@type": "Brand", name: "STIFF" },
        offers: {
          "@type": "Offer",
          priceCurrency: "GEL",
          price: (product.priceCents / 100).toFixed(2),
          availability:
            product.stock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          url: `${SITE_URL}/clothing/${product.slug}`,
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductView slug={slug} />
    </>
  );
}
