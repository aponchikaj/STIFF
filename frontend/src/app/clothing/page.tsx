import type { Metadata } from "next";
import { AsteriskMark } from "@/components/asterisk-mark";

export const metadata: Metadata = { title: "Clothing — STIFF" };

const categories = ["All", "Tees", "Hoodies", "Pants", "Accessories"];

const products = [
  { name: "Stiff Tee 01", price: 120, category: "Tees" },
  { name: "Stiff Tee 02", price: 120, category: "Tees" },
  { name: "Heavy Hoodie 01", price: 260, category: "Hoodies" },
  { name: "Heavy Hoodie 02", price: 260, category: "Hoodies" },
  { name: "Wide Pants 01", price: 220, category: "Pants" },
  { name: "Wide Pants 02", price: 220, category: "Pants" },
  { name: "Asterisk Cap", price: 90, category: "Accessories" },
  { name: "Asterisk Beanie", price: 80, category: "Accessories" },
];

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
                className={`flex h-9 items-center rounded-full px-4 text-[11px] uppercase tracking-[0.15em] ${
                  i === 0
                    ? "bg-zinc-50 text-zinc-950"
                    : "border border-zinc-800 text-zinc-400"
                }`}
              >
                {category}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:mt-12 lg:grid-cols-4">
        {products.map(({ name, price, category }) => (
          <li key={name}>
            <article>
              <div className="flex aspect-[3/4] items-center justify-center bg-zinc-900">
                <AsteriskMark className="size-10 text-zinc-700 sm:size-12" />
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <h2 className="text-xs uppercase tracking-wide sm:text-sm">
                  {name}
                </h2>
                <p className="text-xs text-zinc-400 sm:text-sm">{price} ₾</p>
              </div>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-zinc-600">
                {category}
              </p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
