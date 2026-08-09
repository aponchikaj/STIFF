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
import { Magnetic, Reveal } from "@/components/motion";
import { ProductCarousel } from "@/components/product-carousel";

const outlineBtn =
  "flex h-10 items-center rounded-[2px] border border-subtle px-5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted";

const solidBtn =
  "flex h-12 items-center rounded-[2px] bg-foreground px-8 text-xs font-bold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function Home() {
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
                01 — The drop
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

        {/* 2 — Most wanted: the pieces people like most */}
        <section
          aria-label="Most wanted"
          className="w-full border-t border-subtle px-4 py-20 sm:px-6 sm:py-24"
        >
          <Reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
                02 — Most wanted
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
              03 — Shop by category
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
              04 — The archive
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
      <section className="border-y border-subtle bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              05 — The idea
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
        </div>
      </section>

      {/* 6 — What we stand for */}
      <section
        aria-label="Values"
        className="w-full border-b border-subtle px-4 py-20 sm:px-6 sm:py-24"
      >
        <Reveal>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            06 — The rules we live by
          </p>
        </Reveal>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {[
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
          ].map((value, i) => (
            <Reveal key={value.title} delay={i * 0.08}>
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
        <Reveal className="mt-10">
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
            Never miss a drop
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-muted">
            Make an account to get notified the second a drop lands, track
            your orders, and have your say in the comments.
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
