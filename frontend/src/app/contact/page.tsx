import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact — STIFF" };

export default function ContactPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">Contact</h1>
      <p className="mt-4 max-w-md text-sm text-zinc-400">
        Reach us at hello@stiff.com — a proper contact form is on the way.
      </p>
    </section>
  );
}
