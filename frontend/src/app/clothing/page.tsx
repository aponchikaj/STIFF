import type { Metadata } from "next";
import { Suspense } from "react";
import { ClothingBrowserFromUrl } from "./clothing-browser";

export const metadata: Metadata = {
  title: "Clothing",
  description:
    "Shop the STIFF drop — heavyweight tees, hoodies, pants and accessories designed in Tbilisi. Hard cuts, dense fabric, one mark.",
  alternates: { canonical: "/clothing" },
};

export default function ClothingPage() {
  return (
    <section className="w-full px-4 py-12 sm:px-6 sm:py-16">
      {/* useSearchParams needs a Suspense boundary to keep the page static. */}
      <Suspense fallback={null}>
        <ClothingBrowserFromUrl />
      </Suspense>
    </section>
  );
}
