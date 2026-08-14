import { memo } from "react";
import {
  type ImageFit,
  DETAIL_WIDTHS,
  TILE_WIDTHS,
  asRotation,
  imageSrcSet,
  imageUrl,
  orientedSize,
} from "@/lib/image";
import { AsteriskMark } from "./asterisk-mark";

/**
 * The single image primitive for products and gallery shots.
 *
 * Never renders the stored original — `src` is rewritten to a Cloudinary
 * transformation and offered at several widths so the browser downloads the
 * one that fits the slot. Tiles skip extra placeholder requests so bandwidth
 * goes to the real photo; the surface color holds the box until it lands.
 */

/** Conservative default: assumes a card in a multi-column grid. */
const DEFAULT_SIZES = "(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw";

const FALLBACK_WIDTH: Record<ImageFit, number> = {
  tile: 640,
  detail: 1400,
};

export const ProductImage = memo(function ProductImage({
  src,
  alt,
  aspect = "aspect-[3/4]",
  iconClassName = "size-10 text-subtle",
  className = "",
  sizes = DEFAULT_SIZES,
  width,
  height,
  priority = false,
  fit = "tile",
  rotation = 0,
}: {
  src?: string | null;
  alt: string;
  aspect?: string;
  iconClassName?: string;
  className?: string;
  /** Slot width across breakpoints — get this right or the browser over-fetches. */
  sizes?: string;
  /** Intrinsic size; reserves the exact box and kills layout shift. */
  width?: number | null;
  height?: number | null;
  /** Above the fold: load eagerly and jump the queue. */
  priority?: boolean;
  /** Tiles stay small and cheap; detail is the stage / product gallery. */
  fit?: ImageFit;
  /** Clockwise degrees. Applied at Cloudinary so the reserved box matches. */
  rotation?: number | null;
}) {
  if (!src) {
    return (
      <div
        className={`flex ${aspect} items-center justify-center bg-surface ${className}`}
      >
        <AsteriskMark className={iconClassName} />
      </div>
    );
  }

  const turn = asRotation(rotation);
  const size = orientedSize(width, height, turn);
  const widths = fit === "detail" ? DETAIL_WIDTHS : TILE_WIDTHS;
  const srcSet = imageSrcSet(src, widths, fit, turn);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl(src, FALLBACK_WIDTH[fit], fit, turn)}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={size.width}
      height={size.height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "low"}
      decoding="async"
      // `aspect` wins over any intrinsic width/height attributes, so tiles that
      // opt into a fixed ratio still crop; `aspect=""` keeps natural height and
      // uses the attributes to reserve the right box.
      className={`${aspect} w-full bg-surface object-cover ${aspect ? "" : "h-auto"} ${className}`}
    />
  );
});
