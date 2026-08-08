import type { Metadata } from "next";

export const metadata: Metadata = { title: "Clothing — STIFF" };

export default function ClothingPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
        Clothing
      </h1>
      <p className="mt-4 max-w-md text-sm text-zinc-400">
        The collection drops soon.
      </p>
    </section>
  );
}
