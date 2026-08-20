import type { Metadata } from "next";
import Link from "next/link";
import { AboutTeaser } from "@/components/about-teaser";
import { AsteriskMark } from "@/components/asterisk-mark";
import { CategoryRows } from "@/components/category-rows";
import { DropSignup } from "@/components/drop-signup";
import { FeaturedProducts } from "@/components/featured-products";
import { GalleryPreview } from "@/components/gallery-preview";
import { HomeHero } from "@/components/home-hero";
import { IfGuest, IfShop } from "@/components/if-shop";
import { IntroOverlay } from "@/components/intro-overlay";
import { MarqueeBand } from "@/components/marquee-band";
import { Magnetic, Parallax, Reveal } from "@/components/motion";
import { ProductCarousel } from "@/components/product-carousel";
import { SectionNo } from "@/components/section-no";
import { contentList, contentText, fetchContent } from "@/lib/content-server";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const outlineBtn =
  "flex h-10 items-center rounded-[2px] border border-subtle px-5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted";

const solidBtn =
  "flex h-12 items-center rounded-[2px] bg-foreground px-8 text-xs font-bold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const VALUES = [
  {
    title: "Essential",
    body: "Every piece earns its place. If it doesn't add anything, it doesn't ship.",
  },
  {
    title: "Heavy",
    body: "Weight is a feature. Thick cotton, dense embroidery, hardware that clicks.",
  },
  {
    title: "Ours",
    body: "Designed and worn in Tbilisi first. The asterisk is the spark.",
  },
];

export default async function Home() {
  const [valuesCopy, joinCopy] = await Promise.all([
    fetchContent("home-values"),
    fetchContent("home-join"),
  ]);
  const valuesEyebrow = contentText(
    valuesCopy,
    "eyebrow",
    "The rules we live by",
  );
  const values = contentList(valuesCopy, "items", VALUES);
  const joinTitle = contentText(joinCopy, "title", "Never miss a drop");
  const joinBody = contentText(
    joinCopy,
    "body",
    "Make an account to get notified the second a drop lands, track your orders, and have your say in the comments.",
  );

  return (
    <>
      <IntroOverlay />
      <HomeHero />
      <MarqueeBand />

      {/* 1 — The drop: auto-moving product strip */}
      <IfShop>
        <section
          aria-label="Latest drop"
          className="w-full px-4 py-20 sm:px-6 sm:py-24"
        >
          <Reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
                <SectionNo n={1} /> — The drop
              </p>
              <h2 className="mt-2 text-3xl uppercase tracking-tight sm:text-5xl">
                Latest pieces
              </h2>
            </div>
            <Magnetic>
              <Link href="/clothing" className={outlineBtn}>
                Shop all
              </Link>
            </Magnetic>
          </Reveal>
          <Reveal delay={0.1}>
            <ProductCarousel />
          </Reveal>
        </section>

        {/* 2 — Most wanted */}
        <section
          aria-label="Most wanted"
          className="w-full border-t border-subtle px-4 py-20 sm:px-6 sm:py-24"
        >
          <Reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
                <SectionNo n={2} /> — Most wanted
              </p>
              <h2 className="mt-2 text-3xl uppercase tracking-tight sm:text-5xl">
                What everyone likes
              </h2>
            </div>
            <Magnetic>
              <Link href="/clothing?sort=popular" className={outlineBtn}>
                See all
              </Link>
            </Magnetic>
          </Reveal>
          <FeaturedProducts count={8} />
        </section>

        {/* 3 — Categories as full-bleed rows */}
        <section aria-label="Categories" className="border-t border-subtle">
          <Reveal className="w-full px-4 pb-8 pt-16 sm:px-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              <SectionNo n={3} /> — Shop by category
            </p>
          </Reveal>
          <CategoryRows />
        </section>
      </IfShop>

      {/* 3 — The archive */}
      <section
        aria-label="Gallery preview"
        className="w-full border-t border-subtle px-4 py-20 sm:px-6 sm:py-24"
      >
        <Reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              <SectionNo n={4} /> — The archive
            </p>
            <h2 className="mt-2 text-3xl uppercase tracking-tight sm:text-5xl">
              Worn, shot, kept
            </h2>
          </div>
          <Magnetic>
            <Link href="/gallery" className={outlineBtn}>
              Full gallery
            </Link>
          </Magnetic>
        </Reveal>
        <GalleryPreview />
      </section>

      {/* 4 — Brand statement, admin-editable */}
      <section className="overflow-hidden border-y border-subtle bg-surface">
        <Parallax range={28} className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              <SectionNo n={5} /> — The idea
            </p>
            <div className="mt-4">
              <AboutTeaser />
            </div>
            <Magnetic className="mt-8 inline-block">
              <Link href="/about" className={solidBtn}>
                Our story
              </Link>
            </Magnetic>
          </Reveal>
        </Parallax>
      </section>

      {/* 6 — What we stand for: inverted black band */}
      <section
        aria-label="Values"
        className="theme-invert w-full bg-background px-4 py-20 text-foreground sm:px-6 sm:py-24"
      >
        <Reveal>
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            <SectionNo n={6} /> — {valuesEyebrow}
          </p>
        </Reveal>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {values.map((value, i) => (
            <Reveal
              key={value.title}
              delay={i * 0.08}
              className="flex flex-col items-center text-center"
            >
              <AsteriskMark className="size-5 text-muted" />
              <h3 className="mt-4 font-display text-2xl uppercase tracking-tight sm:text-3xl">
                {value.title}
              </h3>
              <p className="mt-3 max-w-xs text-sm leading-6 text-muted">
                {value.body}
              </p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 flex justify-center">
          <Link
            href="/rules"
            className="rounded-[2px] text-[11px] font-medium uppercase tracking-[0.2em] text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            Read all the rules →
          </Link>
        </Reveal>
      </section>

      {/* 7 — Join: the reason to come back */}
      <section className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-28">
        <Reveal>
          <h2 className="text-4xl uppercase leading-none tracking-tight sm:text-6xl">
            {joinTitle}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-muted">
            {joinBody}
          </p>
          <DropSignup />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <IfShop>
              <Magnetic className="inline-block">
                <Link href="/clothing" className={solidBtn}>
                  Shop the drop
                </Link>
              </Magnetic>
            </IfShop>
            <IfGuest>
              <Magnetic className="inline-block">
                <Link href="/register" className={`${outlineBtn} h-12 px-6`}>
                  Create account
                </Link>
              </Magnetic>
            </IfGuest>
          </div>
        </Reveal>
      </section>

      <MarqueeBand />
    </>
  );
}
