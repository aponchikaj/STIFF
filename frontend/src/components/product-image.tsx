import { imageBlurUrl, imageSrcSet, imageUrl } from "@/lib/image";
import { AsteriskMark } from "./asterisk-mark";

/**
 * The single image primitive for products and gallery shots.
 *
 * Never renders the stored original — `src` is rewritten to a Cloudinary
 * transformation and offered at several widths so the browser downloads the
 * one that fits the slot. A blurred 24px version sits behind it as the
 * placeholder, so tiles are never blank while decoding.
 */

/** Conservative default: assumes a card in a multi-column grid. */
const DEFAULT_SIZES = "(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw";

/** Fallback for browsers ignoring srcset — mid-range, not the original. */
const FALLBACK_WIDTH = 800;

export function ProductImage({
  src,
  alt,
  aspect = "aspect-[3/4]",
  iconClassName = "size-10 text-subtle",
  className = "",
  sizes = DEFAULT_SIZES,
  width,
  height,
  priority = false,
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

  const blur = imageBlurUrl(src);
  const srcSet = imageSrcSet(src);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl(src, FALLBACK_WIDTH)}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={width ?? undefined}
      height={height ?? undefined}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding={priority ? "sync" : "async"}
      style={
        blur
          ? {
              backgroundImage: `url("${blur}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
      // `aspect` wins over any intrinsic width/height attributes, so tiles that
      // opt into a fixed ratio still crop; `aspect=""` keeps natural height and
      // uses the attributes to reserve the right box.
      className={`${aspect} w-full bg-surface object-cover ${aspect ? "" : "h-auto"} ${className}`}
    />
  );
}
