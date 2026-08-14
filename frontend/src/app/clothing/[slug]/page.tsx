import type { Metadata } from "next";
import type { ProductDetail } from "@/lib/api";
import { DETAIL_WIDTHS, imageSrcSet, imageUrl } from "@/lib/image";
import { serverApiBase, SITE_URL } from "@/lib/site";
import { ProductView } from "./product-view";

async function fetchProduct(slug: string): Promise<ProductDetail | null> {
  try {
    const res = await fetch(
      `${serverApiBase()}/products/${encodeURIComponent(slug)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as ProductDetail;
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
  const image = product.images[0]
    ? imageUrl(product.images[0], 1200, "detail")
    : undefined;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/clothing/${product.slug}` },
    openGraph: {
      title: `${product.name} — STIFF`,
      description,
      url: `${SITE_URL}/clothing/${product.slug}`,
      images: image ? [{ url: image }] : undefined,
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
        image:
          product.images.length > 0
            ? product.images.map((src) => imageUrl(src, 1200, "detail"))
            : undefined,
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

  const hero = product?.images[0];

  return (
    <>
      {hero && (
        <link
          rel="preload"
          as="image"
          href={imageUrl(hero, 800, "detail")}
          imageSrcSet={imageSrcSet(hero, DETAIL_WIDTHS, "detail") || undefined}
          imageSizes="(min-width: 1024px) 400px, (min-width: 640px) 45vw, 70vw"
          fetchPriority="high"
        />
      )}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductView key={slug} slug={slug} initial={product} />
    </>
  );
}
