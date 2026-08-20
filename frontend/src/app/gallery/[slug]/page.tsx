import type { Metadata } from "next";
import type { GalleryItemDetail } from "@/lib/api";
import { creditsToSchema } from "@/components/gallery-credits";
import { galleryPath } from "@/lib/gallery-url";
import { DETAIL_WIDTHS, imageSrcSet, imageUrl, orientedSize } from "@/lib/image";
import { serverApiBase, SITE_URL } from "@/lib/site";
import { GalleryItemView } from "./gallery-item-view";

/**
 * Fetched through `serverApiBase` rather than the browser client: on a
 * deployed frontend `NEXT_PUBLIC_API_URL` is a relative `/api`, which resolves
 * in the browser and nowhere else.
 */
async function fetchShot(slug: string): Promise<GalleryItemDetail | null> {
  try {
    const res = await fetch(
      `${serverApiBase()}/gallery/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as GalleryItemDetail;
  } catch {
    return null;
  }
}

/**
 * Resolved on the server so a shared link previews the actual photograph
 * instead of the generic site card. A failure here must not break the page —
 * the client view renders its own not-found state.
 */
export async function generateMetadata({
  params,
}: PageProps<"/gallery/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const item = await fetchShot(slug);
  if (!item) return { title: "Gallery" };

  const title = `${item.title} — Archive`;
  const description =
    item.description ??
    item.altText ??
    `Shot ${item.title} from the STIFF archive — worn, shot, kept.`;
  const image = imageUrl(item.imageUrl, 1200, "detail", item.rotation);
  const path = galleryPath(item);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title,
      description,
      url: path,
      images: [{ url: image, alt: item.altText ?? item.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function GalleryItemPage({
  params,
}: PageProps<"/gallery/[slug]">) {
  const { slug } = await params;
  // Deduped with generateMetadata's call by Next's fetch cache.
  const item = await fetchShot(slug);

  // ImageObject is what an image search actually reads: the caption, the
  // dimensions, who made it, and a licence pointing back at the page it
  // belongs to. `creator` is the half that matters most here — an image
  // result that names the photographer is worth more to them than a credit
  // line nobody outside the page ever sees.
  const jsonLd = item
    ? {
        "@context": "https://schema.org",
        "@type": "ImageObject",
        contentUrl: imageUrl(item.imageUrl, 1600, "detail", item.rotation),
        thumbnailUrl: imageUrl(item.imageUrl, 400, "tile", item.rotation),
        name: item.title,
        caption: item.altText ?? item.description ?? undefined,
        description: item.description ?? undefined,
        width: orientedSize(item.width, item.height, item.rotation).width,
        height: orientedSize(item.width, item.height, item.rotation).height,
        uploadDate: item.createdAt,
        representativeOfPage: true,
        url: `${SITE_URL}${galleryPath(item)}`,
        ...creditsToSchema(item.credits ?? []),
        ...(item.tags?.length
          ? { keywords: item.tags.map((tag) => tag.label).join(", ") }
          : {}),
        // The shoot is the closer parent when there is one; the archive is
        // still the collection either way.
        isPartOf: item.shoot
          ? {
              "@type": "ImageGallery",
              name: item.shoot.title,
              url: `${SITE_URL}/gallery/shoot/${item.shoot.slug}`,
              ...(item.shoot.shotOn ? { datePublished: item.shoot.shotOn } : {}),
              isPartOf: {
                "@type": "CollectionPage",
                name: "STIFF Archive",
                url: `${SITE_URL}/gallery`,
              },
            }
          : {
              "@type": "CollectionPage",
              name: "STIFF Archive",
              url: `${SITE_URL}/gallery`,
            },
        ...(item.shoot?.location
          ? { contentLocation: { "@type": "Place", name: item.shoot.location } }
          : {}),
        // Pieces worn in the shot. Google reads this to connect a photograph
        // to something buyable, which is the whole point of tagging them.
        ...(item.products?.length
          ? {
              about: item.products.map((product) => ({
                "@type": "Product",
                name: product.name,
                url: `${SITE_URL}/clothing/${product.slug}`,
              })),
            }
          : {}),
        copyrightHolder: { "@type": "Organization", name: "STIFF" },
        copyrightNotice: "© STIFF",
        creditText: "STIFF",
        // Where someone goes to ask about using the photograph, which is what
        // `acquireLicensePage` is for — it is the licensable-image signal.
        acquireLicensePage: `${SITE_URL}/contact`,
      }
    : null;

  return (
    <>
      {item && (
        <>
          <link
            rel="preload"
            as="image"
            href={imageUrl(item.imageUrl, 1400, "detail", item.rotation)}
            imageSrcSet={
              imageSrcSet(item.imageUrl, DETAIL_WIDTHS, "detail", item.rotation) || undefined
            }
            imageSizes="(min-width: 1024px) 80vw, 100vw"
            fetchPriority="high"
          />
          {item.next && (
            <link
              rel="prefetch"
              as="image"
              href={imageUrl(item.next.imageUrl, 1400, "detail", item.next.rotation)}
            />
          )}
          {item.prev && (
            <link
              rel="prefetch"
              as="image"
              href={imageUrl(item.prev.imageUrl, 1400, "detail", item.prev.rotation)}
            />
          )}
        </>
      )}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <GalleryItemView key={slug} slug={slug} initial={item} />
    </>
  );
}
