import Link from "next/link";
import { AsteriskMark } from "./asterisk-mark";

const categories = ["Tees", "Hoodies", "Pants", "Accessories"];

export function CategoryRows() {
  return (
    <ul className="border-t border-subtle">
      {categories.map((category, i) => (
        <li key={category} className="border-b border-subtle">
          <Link
            href={`/clothing?c=${category}`}
            className="group flex items-center justify-between gap-4 px-4 py-6 transition-colors hover:bg-foreground hover:text-background focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none sm:px-6 sm:py-8"
          >
            <span className="w-8 text-[11px] font-medium tracking-[0.2em] text-muted group-hover:text-background/60 group-focus-visible:text-background/60">
              0{i + 1}
            </span>
            <span className="font-display flex-1 text-4xl uppercase leading-none tracking-tight sm:text-7xl">
              {category}
            </span>
            <AsteriskMark className="size-5 transition-transform duration-500 group-hover:rotate-[360deg] sm:size-8" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
