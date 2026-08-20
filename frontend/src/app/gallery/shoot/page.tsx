import type { Metadata } from "next";
import Link from "next/link";
import type { ShootSummary } from "@/lib/api";
import { ProductImage } from "@/components/product-image";
import { btnOutline } from "@/components/ui";
import { shootMeta } from "@/lib/shoot-meta";
import { serverApiBase, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Shoots",
  description:
    "Every STIFF shoot — the day, the place, and the people who made it.",
  alternates: { canonical: "/gallery/shoot" },
};

/** Two-up on phones, four-up on a desktop: covers, not thumbnails. */
const COVER_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

async function fetchShoots(): Promise<ShootSummary[]> {
  try {
    const res = await fetch(`${serverApiBase()}/gallery/shoots`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as ShootSummary[];
  } catch {
    return [];
  }
}

export default async function ShootsPage() {
  const shoots = await fetchShoots();

  return (
    <section className="w-full px-4 py-12 sm:px-6 sm:py-16">
      {shoots.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: "STIFF Shoots",
              url: `${SITE_URL}/gallery/shoot`,
              hasPart: shoots.map((shoot) => ({
                "@type": "ImageGallery",
                name: shoot.title,
                url: `${SITE_URL}/gallery/shoot/${shoot.slug}`,
                ...(shoot.shotOn ? { datePublished: shoot.shotOn } : {}),
              })),
            }),
          }}
        />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
          Shoots
        </h1>
        <Link
          href="/gallery"
          className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground"
        >
          Every shot →
        </Link>
      </div>

      {shoots.length === 0 ? (
        <div className="mt-12 flex flex-col items-start gap-6">
          <p className="max-w-md text-sm leading-7 text-muted">
            No shoots yet. The archive is still one long roll — it gets grouped
            into days as the shoots are written up.
          </p>
          <Link href="/gallery" className={btnOutline}>
            Browse the archive
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:mt-12 sm:grid-cols-3 lg:grid-cols-4">
          {shoots.map((shoot) => {
            const meta = shootMeta(shoot);
            return (
              <li key={shoot.id}>
                <Link
                  href={`/gallery/shoot/${shoot.slug}`}
                  className="group block rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                >
                  <ProductImage
                    src={shoot.cover?.imageUrl}
                    alt={
                      shoot.cover?.altText ?? `Cover shot from ${shoot.title}`
                    }
                    rotation={shoot.cover?.rotation}
                    blurDataUrl={shoot.cover?.blurDataUrl}
                    sizes={COVER_SIZES}
                    className="transition-opacity group-hover:opacity-90"
                  />
                  <h2 className="mt-3 text-sm uppercase tracking-tight text-foreground">
                    {shoot.title}
                  </h2>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                    {shoot.shotCount} shot{shoot.shotCount === 1 ? "" : "s"}
                    {!shoot.isPublished && " — draft"}
                  </p>
                  {meta && (
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-muted/70">
                      {meta}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
