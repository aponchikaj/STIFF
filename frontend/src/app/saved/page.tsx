import type { Metadata } from "next";
import { SavedGrid } from "@/components/saved-grid";

export const metadata: Metadata = {
  title: "Saved",
  description: "Pieces you saved to come back to.",
  // A personal list. Nothing here belongs in a search index.
  robots: { index: false },
};

export default function SavedPage() {
  return (
    <section className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-4xl uppercase tracking-tight sm:text-5xl">Saved</h1>
      <div className="mt-10">
        <SavedGrid />
      </div>
    </section>
  );
}
