import type { Metadata } from "next";
import { SearchView } from "./search-view";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

export default function SearchPage() {
  return (
    <section className="w-full flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <SearchView />
    </section>
  );
}
