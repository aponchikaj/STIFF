import type { Metadata } from "next";
import { ClothingBrowser } from "./clothing-browser";

export const metadata: Metadata = {
  title: "Clothing",
  description:
    "Shop the STIFF drop — heavyweight tees, hoodies, pants and accessories designed in Tbilisi. Hard cuts, dense fabric, one mark.",
  alternates: { canonical: "/clothing" },
};

const categories = ["All", "Tees", "Hoodies", "Pants", "Accessories"];

export default async function ClothingPage({
  searchParams,
}: PageProps<"/clothing">) {
  const { c } = await searchParams;
  const active = typeof c === "string" && categories.includes(c) ? c : "All";

  return (
    <section className="w-full px-4 py-12 sm:px-6 sm:py-16">
      <ClothingBrowser category={active} />
    </section>
  );
}
