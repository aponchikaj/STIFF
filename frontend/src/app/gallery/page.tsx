import type { Metadata } from "next";
import { Reveal } from "@/components/motion";
import { GalleryGrid } from "./gallery-grid";

export const metadata: Metadata = { title: "Gallery — STIFF" };

export default function GalleryPage() {
  return (
    <section className="w-full px-4 py-12 sm:px-6 sm:py-16">
      <Reveal className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
          Gallery
        </h1>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          The archive
        </p>
      </Reveal>
      <GalleryGrid />
    </section>
  );
}
