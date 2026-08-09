import type { Metadata } from "next";
import { Reveal } from "@/components/motion";
import { ProductCard } from "@/components/product-card";
import { products } from "@/lib/products";

export const metadata: Metadata = { title: "Clothing — STIFF" };

const categories = ["All", "Tees", "Hoodies", "Pants", "Accessories"];

export default function ClothingPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
          Clothing
        </h1>
        <ul className="flex flex-wrap items-center gap-1.5">
          {categories.map((category, i) => (
            <li key={category}>
              {/* Static chips until filtering ships with real product data */}
              <span
                className={`flex h-9 items-center rounded-full px-4 text-[11px] font-medium uppercase tracking-[0.15em] ${
                  i === 0
                    ? "bg-foreground text-background"
                    : "border border-subtle text-muted"
                }`}
              >
                {category}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:mt-12 lg:grid-cols-4">
        {products.map((product, i) => (
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
