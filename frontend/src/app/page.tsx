import Link from "next/link";
import { AboutTeaser } from "@/components/about-teaser";
import { IfGuest, IfShop } from "@/components/if-shop";
import { AsteriskMark } from "@/components/asterisk-mark";
import { CategoryRows } from "@/components/category-rows";
import { FeaturedProducts } from "@/components/featured-products";
import { GalleryPreview } from "@/components/gallery-preview";
import { IntroOverlay } from "@/components/intro-overlay";
import { MarqueeBand } from "@/components/marquee-band";
import { Magnetic, Reveal } from "@/components/motion";

const outlineBtn =
  "flex h-10 items-center rounded-[2px] border border-subtle px-5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted";

export default function Home() {
  return (
    <>
      <IntroOverlay />
      <section className="flex h-[87svh] items-center justify-center px-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <AsteriskMark className="spin-on-hover size-16 sm:size-28" />
          <h1 className="text-7xl uppercase leading-none tracking-tight sm:text-9xl">
            Stiff
          </h1>
        </div>
      </section>

      <MarqueeBand />

      <IfShop>
        <section className="w-full px-4 py-24 sm:px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5">
            <h2 className="text-3xl uppercase tracking-tight sm:text-5xl">
              Featured drops
            </h2>
            <Magnetic>
              <Link href="/clothing" className={outlineBtn}>
                View all
              </Link>
            </Magnetic>
          </Reveal>
          <FeaturedProducts />
        </section>

        <section aria-label="Categories">
          <Reveal className="w-full px-4 pb-8 sm:px-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              Shop by category
            </p>
          </Reveal>
          <CategoryRows />
        </section>
      </IfShop>

      <section
        aria-label="Gallery preview"
        className="w-full px-4 py-24 sm:px-6"
      >
        <Reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5">
          <h2 className="text-3xl uppercase tracking-tight sm:text-5xl">
            From the archive
          </h2>
          <Magnetic>
            <Link href="/gallery" className={outlineBtn}>
              Full gallery
            </Link>
          </Magnetic>
        </Reveal>
        <GalleryPreview />
      </section>

      <section className="border-y border-subtle bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <Reveal>
            <AboutTeaser />
            <Magnetic className="mt-8 inline-block">
              <Link
                href="/about"
                className="flex h-12 items-center rounded-[2px] bg-foreground px-8 text-xs font-bold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Our story
              </Link>
            </Magnetic>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-28">
        <Reveal>
          <h2 className="text-4xl uppercase leading-none tracking-tight sm:text-6xl">
            Wear the essential
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-muted">
            Heavy fabric, hard cuts, one mark. Join in — like, comment and get
            notified the second a drop lands.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <IfShop>
              <Magnetic className="inline-block">
                <Link
                  href="/clothing"
                  className="flex h-12 items-center rounded-[2px] bg-foreground px-8 text-xs font-bold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
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
    </>
  );
}
