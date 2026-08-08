import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gallery — STIFF" };

export default function GalleryPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">Gallery</h1>
      <p className="mt-4 max-w-md text-sm text-zinc-400">
        Nothing here yet — the first shoot is on its way.
      </p>
    </section>
  );
}
