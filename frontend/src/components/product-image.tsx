import { AsteriskMark } from "./asterisk-mark";

/** Product/gallery image with the branded placeholder fallback. */
export function ProductImage({
  src,
  alt,
  aspect = "aspect-[3/4]",
  iconClassName = "size-10 text-subtle",
  className = "",
}: {
  src?: string | null;
  alt: string;
  aspect?: string;
  iconClassName?: string;
  className?: string;
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
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`${aspect} w-full bg-surface object-cover ${className}`}
    />
  );
}
