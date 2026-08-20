import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ShootDetail } from "@/lib/api";
import {
  creditsToSchema,
  GalleryCredits,
} from "@/components/gallery-credits";
import { ProductImage } from "@/components/product-image";
import { ShareButton } from "@/components/share-button";
import { galleryPath } from "@/lib/gallery-url";
import { imageUrl, orientedSize } from "@/lib/image";
import { shootShareSubject } from "@/lib/share-subject";
import { shootMeta } from "@/lib/shoot-meta";
import { serverApiBase, SITE_URL } from "@/lib/site";

/** A shoot page is a contact sheet: bigger than the archive grid, still a grid. */
const SHEET_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

async function fetchShoot(slug: string): Promise<ShootDetail | null> {
  try {
    const res = await fetch(
      `${serverApiBase()}/gallery/shoots/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as ShootDetail;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/gallery/shoot/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const shoot = await fetchShoot(slug);
  if (!shoot) return { title: "Shoot" };

  const meta = shootMeta(shoot);
  const description =
    shoot.description ??
    [`${shoot.shotCount} shots from the STIFF archive`, meta]
      .filter(Boolean)
      .join(" — ");
  const image = shoot.cover
    ? imageUrl(shoot.cover.imageUrl, 1200, "detail", shoot.cover.rotation)
    : undefined;

  return {
    title: shoot.title,
    description,
    alternates: { canonical: `/gallery/shoot/${shoot.slug}` },
    // A draft shoot is reachable by link for whoever is assembling it, but it
    // has no business in an index.
    robots: shoot.isPublished ? undefined : { index: false, follow: false },
    openGraph: {
      type: "article",
      title: shoot.title,
      description,
      url: `/gallery/shoot/${shoot.slug}`,
      ...(image
        ? { images: [{ url: image, alt: shoot.cover?.altText ?? shoot.title }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: shoot.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ShootPage({
  params,
}: PageProps<"/gallery/shoot/[slug]">) {
  const { slug } = await params;
  // Deduped with generateMetadata's call by Next's fetch cache.
  const shoot = await fetchShoot(slug);
  if (!shoot) notFound();

  const meta = shootMeta(shoot);
  const people = creditsToSchema(shoot.credits);
  const share = shootShareSubject(shoot);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: shoot.title,
    url: `${SITE_URL}/gallery/shoot/${shoot.slug}`,
    ...(shoot.description ? { description: shoot.description } : {}),
    ...(shoot.shotOn ? { datePublished: shoot.shotOn } : {}),
    ...(shoot.location
      ? { contentLocation: { "@type": "Place", name: shoot.location } }
      : {}),
    ...people,
    isPartOf: {
      "@type": "CollectionPage",
      name: "STIFF Archive",
      url: `${SITE_URL}/gallery`,
    },
    image: shoot.items.map((item) => {
      const size = orientedSize(item.width, item.height, item.rotation);
      return {
        "@type": "ImageObject",
        contentUrl: imageUrl(item.imageUrl, 1600, "detail", item.rotation),
        thumbnailUrl: imageUrl(item.imageUrl, 400, "tile", item.rotation),
        name: item.title,
        caption: item.altText ?? undefined,
        width: size.width,
        height: size.height,
        url: `${SITE_URL}${galleryPath(item)}`,
        ...people,
      };
    }),
  };

  return (
    <section className="w-full px-4 py-12 sm:px-6 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/gallery/shoot"
        className="rounded-[2px] text-[10px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
      >
        ← All shoots
      </Link>

      <header className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-4xl uppercase leading-none tracking-tight sm:text-6xl">
            {shoot.title}
          </h1>
          <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
            {[meta, `${shoot.shotCount} shot${shoot.shotCount === 1 ? "" : "s"}`]
              .filter(Boolean)
              .join(" · ")}
            {!shoot.isPublished && " · draft"}
          </p>
          {shoot.description && (
            <p className="mt-5 max-w-prose text-sm leading-7 text-muted">
              {shoot.description}
            </p>
          )}
        </div>
        {share && <ShareButton subject={share} />}
      </header>

      {shoot.items.length === 0 ? (
        <p className="mt-12 max-w-md text-sm leading-7 text-muted">
          Nothing filed under this shoot yet.
        </p>
      ) : (
        <ul className="mt-12 grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {shoot.items.map((item, index) => (
            <li key={item.id}>
              <Link
                href={galleryPath(item)}
                className="group block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
              >
                <ProductImage
                  src={item.imageUrl}
                  alt={item.altText ?? item.title}
                  aspect=""
                  width={item.width}
                  height={item.height}
                  rotation={item.rotation}
                  blurDataUrl={item.blurDataUrl}
                  sizes={SHEET_SIZES}
                  fit="detail"
                  priority={index < 3}
                  className="transition-opacity group-hover:opacity-90"
                />
                <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                  {item.title}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <GalleryCredits
        credits={shoot.credits}
        heading="Made by"
        className="mt-16 max-w-xl"
      />
    </section>
  );
}
