"use client";

import { useEffect } from "react";
import { imageSrcSet, imageUrl, DETAIL_WIDTHS } from "@/lib/image";

/**
 * Full-screen image viewer. Closes on backdrop click, the × button, or Escape,
 * and locks page scroll while open.
 *
 * Even at full screen it serves a capped render rather than the stored
 * original — 1920px covers any display worth serving, at a fraction of the
 * bytes.
 */
const MAX_WIDTH = 1920;

export function Lightbox({
  src,
  alt = "",
  caption,
  onClose,
}: {
  src: string;
  alt?: string;
  caption?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption ? `${caption} — full size` : "Full-size image"}
      onClick={onClose}
      className="fixed inset-0 z-[90] flex cursor-zoom-out items-center justify-center bg-foreground/90 p-4"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl(src, MAX_WIDTH, "detail")}
        srcSet={imageSrcSet(src, DETAIL_WIDTHS, "detail") || undefined}
        sizes="100vw"
        alt={alt}
        decoding="async"
        className="max-h-[92dvh] max-w-full rounded-[2px] object-contain"
      />
      {caption && (
        <p className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.25em] text-background">
          {caption}
        </p>
      )}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-[2px] bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
      >
        ×
      </button>
    </div>
  );
}
