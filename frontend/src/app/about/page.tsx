import type { Metadata } from "next";
import Link from "next/link";
import type { GalleryItem, PaginatedShots } from "@/lib/api";
import { AsteriskMark } from "@/components/asterisk-mark";
import { Magnetic, Parallax, Reveal, ScrollSpin } from "@/components/motion";
import { ProductImage } from "@/components/product-image";
import { galleryPath } from "@/lib/gallery-url";
import { contentList, contentText, fetchContent } from "@/lib/content-server";
import { serverApiBase } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "STIFF is a clothing brand built on one idea: strip everything back until only the essential is left, then make that essential unignorable. Designed and worn in Tbilisi first.",
  alternates: { canonical: "/about" },
};

/** Full-bleed between chapters, so the photograph is the pause, not a garnish. */
const PLATE_SIZES = "(min-width: 1024px) 60vw, 100vw";

const CHAPTERS = [
  {
    title: "The founding",
    body: "Two people, a room in Tbilisi, and a disagreement about what a t-shirt should weigh. Everything since has been an argument about what to leave out — and every piece that shipped won that argument.",
  },
  {
    title: "The asterisk",
    body: "The mark started as a footnote on a spec sheet: the detail that had to stay. It ended up on the front. If something does not earn its place it gets cut, and what survives carries the asterisk — a footnote that became the headline.",
  },
  {
    title: "Tbilisi first",
    body: "Every piece is worn here before it is sold anywhere. The city is hard on clothes — hills, heat, long nights, worse pavements — and a season on these streets tells you more about a seam than a lab ever will.",
  },
];

/**
 * Archive photographs for the story.
 *
 * The admin can name specific shots; the fallback is simply the newest ones,
 * so the page has imagery from the day the archive has anything in it rather
 * than only after somebody curates it.
 */
async function fetchShots(slugs: string[], need: number): Promise<GalleryItem[]> {
  try {
    const query = slugs.length > 0 ? "" : `?pageSize=${need}&sort=newest`;
    const res = await fetch(`${serverApiBase()}/gallery${query}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const page = (await res.json()) as PaginatedShots;
    if (slugs.length === 0) return page.items;

    // Named order wins, and a slug that no longer exists is skipped rather
    // than leaving a hole where a photograph was.
    const bySlug = new Map(page.items.map((item) => [item.slug, item]));
    return slugs
      .map((slug) => bySlug.get(slug))
      .filter((item): item is GalleryItem => item !== undefined);
  } catch {
    return [];
  }
}

function Separator() {
  return (
    <div aria-hidden="true" className="flex justify-center py-14">
      {/* Rotates with scroll position */}
      <ScrollSpin>
        <AsteriskMark className="size-6 text-muted" />
      </ScrollSpin>
    </div>
  );
}

export default async function AboutPage() {
  const copy = await fetchContent("about");
  const eyebrow = contentText(copy, "eyebrow", "Tbilisi — est. 2026");
  const title = contentText(copy, "title", "Nothing extra");
  const body = contentText(
    copy,
    "body",
    "STIFF started in Tbilisi with one idea: make the few things you actually wear, and make them heavy enough to last.",
  );
  const chapters = contentList(copy, "chapters", CHAPTERS);
  const cta = contentText(copy, "cta", "See the first drop");

  const slugs = contentText(copy, "shots", "")
    .split(",")
    .map((one) => one.trim())
    .filter(Boolean);
  // One photograph between chapters, not after the last one — the closing
  // button is the end of the page.
  const shots = await fetchShots(slugs, Math.max(1, chapters.length - 1));

  return (
    <article className="w-full">
      <header className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <Reveal>
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-muted">
            {eyebrow}
          </p>
          <h1 className="mt-6 text-4xl uppercase leading-none tracking-tight sm:text-7xl">
            {title}
          </h1>
          <p className="mx-auto mt-8 max-w-xl whitespace-pre-line text-sm leading-7 text-muted">
            {body}
          </p>
        </Reveal>
      </header>

      {chapters.map((chapter, i) => (
        <section key={chapter.title} aria-label={chapter.title}>
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
            <Reveal>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-3 text-3xl uppercase leading-none tracking-tight sm:text-5xl">
                {chapter.title}
              </h2>
              <p className="mt-5 max-w-xl whitespace-pre-line text-sm leading-7 text-muted">
                {chapter.body}
              </p>
            </Reveal>
          </div>

          {shots[i] && i < chapters.length - 1 ? (
            <Plate shot={shots[i]} />
          ) : (
            <Separator />
          )}
        </section>
      ))}

      <div className="mx-auto w-full max-w-3xl px-4 pb-28 sm:px-6">
        <Reveal className="flex justify-center">
          <Magnetic>
            <Link
              href="/clothing"
              className="flex h-12 items-center rounded-[2px] bg-foreground px-8 text-xs font-bold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {cta}
            </Link>
          </Magnetic>
        </Reveal>
      </div>
    </article>
  );
}

/** One archive photograph, linked back to the shot it came from. */
function Plate({ shot }: { shot: GalleryItem }) {
  return (
    <figure className="my-20 overflow-hidden bg-surface">
      <Parallax range={20}>
        <Link
          href={galleryPath(shot)}
          className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
        >
          <ProductImage
            src={shot.imageUrl}
            alt={shot.altText ?? `Archive shot ${shot.title}`}
            aspect=""
            width={shot.width}
            height={shot.height}
            rotation={shot.rotation}
            blurDataUrl={shot.blurDataUrl}
            sizes={PLATE_SIZES}
            fit="detail"
            className="mx-auto max-h-[80dvh] w-auto transition-opacity group-hover:opacity-90"
          />
        </Link>
      </Parallax>
      <figcaption className="mt-3 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
        {shot.title} — from the archive
      </figcaption>
    </figure>
  );
}
