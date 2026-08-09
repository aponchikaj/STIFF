import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion";
import { ProductCard } from "@/components/product-card";
import { products } from "@/lib/products";

export const metadata: Metadata = { title: "Clothing — STIFF" };

const categories = ["All", "Tees", "Hoodies", "Pants", "Accessories"];

export default async function ClothingPage({
  searchParams,
}: PageProps<"/clothing">) {
  const { c } = await searchParams;
  const active =
    typeof c === "string" && categories.includes(c) ? c : "All";
  const filtered =
    active === "All"
      ? products
      : products.filter((p) => p.category === active);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
            Clothing
          </h1>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {filtered.length} {filtered.length === 1 ? "piece" : "pieces"}
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-1.5">
          {categories.map((category) => (
            <li key={category}>
              <Link
                href={category === "All" ? "/clothing" : `/clothing?c=${category}`}
                aria-current={active === category ? "page" : undefined}
                className={`flex h-9 items-center rounded-[2px] px-4 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
                  active === category
                    ? "bg-foreground text-background"
                    : "border border-subtle text-muted hover:border-foreground hover:text-foreground"
                }`}
              >
                {category}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:mt-12 lg:grid-cols-4">
        {filtered.map((product, i) => (
          <li key={product.slug}>
            <Reveal delay={(i % 4) * 0.06}>
              <ProductCard product={product} />
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
