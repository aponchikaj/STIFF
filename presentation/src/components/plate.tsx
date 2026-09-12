import { PLATES } from "@/content/plates";
import { asRotation, imageSrcSet, imageUrl, TILE_WIDTHS, DETAIL_WIDTHS } from "@/lib/image";

/**
 * One photograph from the archive.
 *
 * A plain <img> with a srcSet, exactly as the shop does it in
 * `frontend/src/components/product-image.tsx`. Not `next/image`: that would
 * need `images.remotePatterns` for res.cloudinary.com in next.config.ts and
 * throws at runtime without it, and buys nothing here where every source is
 * known at build time.
 */
export function Plate({
  id,
  className,
  sizes = "50vw",
  fit = "detail",
  priority = false,
}: {
  id: string;
  className?: string;
  sizes?: string;
  fit?: "tile" | "detail";
  priority?: boolean;
}) {
  const plate = PLATES[id];
  if (!plate) return null;

  const turn = asRotation(plate.rotation);
  const widths = fit === "detail" ? DETAIL_WIDTHS : TILE_WIDTHS;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl(plate.src, fit === "detail" ? 1400 : 640, fit, turn)}
      srcSet={imageSrcSet(plate.src, widths, fit, turn)}
      sizes={sizes}
      alt={plate.alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}
