import Link from "next/link";
import { AsteriskMark } from "@/components/asterisk-mark";
import { CategoryRows } from "@/components/category-rows";
import { MarqueeBand } from "@/components/marquee-band";
import { Magnetic, Reveal } from "@/components/motion";
import { ProductCard } from "@/components/product-card";
import { SocialLinks } from "@/components/social-links";
import { featuredProducts } from "@/lib/products";

export default function Home() {
  return (
    <>
      <section className="flex h-[87svh] items-center justify-center px-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <AsteriskMark className="spin-on-hover size-16 sm:size-28" />
          <h1 className="text-7xl uppercase leading-none tracking-tight sm:text-9xl">
            Stiff
          </h1>
        </div>
      </section>

      <MarqueeBand />

      <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <Reveal className="flex items-end justify-between gap-4">
          <h2 className="text-3xl uppercase tracking-tight sm:text-5xl">
            Featured drops
          </h2>
          <Magnetic>
            <Link
              href="/clothing"
              className="flex h-10 items-center rounded-[2px] border border-subtle px-5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
            >
              View all
            </Link>
          </Magnetic>
        </Reveal>
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
          {featuredProducts.map((product, i) => (
            <li key={product.slug}>
              <Reveal delay={i * 0.08}>
                <ProductCard product={product} />
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Categories">
        <Reveal className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Shop by category
          </p>
        </Reveal>
        <CategoryRows />
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-28 text-center sm:px-6 sm:py-36">
        <Reveal>
          <h2 className="text-4xl uppercase leading-none tracking-tight sm:text-6xl">
            Wear the essential
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-muted">
            Everything stripped back until only the necessary is left. Heavy
            fabric, hard cuts, one mark. That&apos;s the whole idea.
          </p>
          <Magnetic className="mt-8 inline-block">
            <Link
              href="/about"
              className="flex h-11 items-center rounded-[2px] border border-subtle px-6 text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
            >
              Our story
            </Link>
          </Magnetic>
        </Reveal>
      </section>

      <section className="border-t border-subtle">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-4 py-20 sm:px-6 sm:py-24">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              Next up
            </p>
            <h2 className="mt-3 text-5xl uppercase leading-[0.9] tracking-tight sm:text-8xl">
              Drop 001
              <span aria-hidden="true" className="text-muted"> — </span>
              Soon
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-muted">
              First pieces are in production. Watch it happen.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <SocialLinks />
          </Reveal>
        </div>
      </section>
    </>
  );
}
