import type { Metadata } from "next";

export const metadata: Metadata = { title: "About — STIFF" };

export default function AboutPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">About</h1>
      <p className="mt-4 max-w-md text-sm text-zinc-400">
        The story of STIFF, coming together.
      </p>
    </section>
  );
}
