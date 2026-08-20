"use client";

import Link from "next/link";
import type { ArchiveShot } from "@/lib/api";
import { galleryPath } from "@/lib/gallery-url";
import { asRotation, imageSrcSet, imageUrl, TILE_WIDTHS } from "@/lib/image";
import { Reveal } from "./motion";

/**
 * "Seen in the archive" — the shots featuring this piece.
 *
 * The gallery and the shop have been two separate worlds on this site. A
 * garment photographed on someone in a real room sells harder than the same
 * garment flat on a white background, and the archive is already full of them.
 */
export function ArchiveStrip({
  shots,
  productName,
}: {
  shots: ArchiveShot[];
  productName: string;
}) {
  if (shots.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
      <Reveal>
        <h2 className="text-2xl uppercase tracking-tight sm:text-4xl">
          Seen in the archive
        </h2>
      </Reveal>
      <ul className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-4">
        {shots.map((shot) => (
          <li
            key={shot.id}
            className="w-[60%] shrink-0 snap-start sm:w-auto"
          >
            <Link
              href={galleryPath(shot)}
              className="group block overflow-hidden rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(shot.imageUrl, 600, "tile", asRotation(shot.rotation))}
                srcSet={
                  imageSrcSet(
                    shot.imageUrl,
                    TILE_WIDTHS,
                    "tile",
                    asRotation(shot.rotation),
                  ) || undefined
                }
                sizes="(min-width: 1024px) 240px, (min-width: 640px) 30vw, 60vw"
                // The shot's own description when it has one. Falling back to
                // the title alone would read "0042" to a screen reader, so the
                // piece is named instead.
                alt={shot.altText ?? `${productName}, shot ${shot.title}`}
                loading="lazy"
                decoding="async"
                className="aspect-[4/5] w-full bg-surface object-cover transition-opacity duration-200 group-hover:opacity-90"
              />
              <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                {shot.title}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
