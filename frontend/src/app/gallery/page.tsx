import type { Metadata } from "next";
import { AsteriskMark } from "@/components/asterisk-mark";
import { Reveal } from "@/components/motion";

export const metadata: Metadata = { title: "Gallery — STIFF" };

// Varied aspect ratios until real photography lands in each slot
const frames = [
  "aspect-[3/4]",
  "aspect-square",
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-square",
  "aspect-[3/4]",
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[3/4]",
];

export default function GalleryPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
          Gallery
        </h1>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          Archive — first shoot on its way
        </p>
      </div>

      <div className="mt-10 columns-2 gap-4 sm:mt-12 sm:columns-3">
        {frames.map((aspect, i) => (
          <Reveal
            key={i}
            delay={(i % 3) * 0.06}
            className="mb-4 break-inside-avoid"
          >
            <figure>
              <div
                className={`flex ${aspect} items-center justify-center bg-surface`}
              >
                <AsteriskMark className="size-8 text-subtle" />
              </div>
              <figcaption className="mt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                00{i + 1}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
