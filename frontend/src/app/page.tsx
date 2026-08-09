import Link from "next/link";
import { AsteriskMark } from "@/components/asterisk-mark";
import { MarqueeBand } from "@/components/marquee-band";
import { Magnetic, Reveal } from "@/components/motion";
import { ProductCard } from "@/components/product-card";
import { featuredProducts } from "@/lib/products";

export default function Home() {
  return (
    <>
      <section className="flex h-[90svh] flex-col items-center justify-center gap-6 px-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <AsteriskMark className="spin-on-hover size-16 sm:size-28" />
          <h1 className="text-7xl uppercase leading-none tracking-tight sm:text-9xl">
            Stiff
          </h1>
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted sm:text-sm">
          Essential clothing. Nothing extra.
        </p>
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
    </>
  );
}
