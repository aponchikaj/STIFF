import Image from "next/image";
import Link from "next/link";
import { contentText, fetchContent, fetchDrop } from "@/lib/content-server";
import { DETAIL_WIDTHS, imageSrcSet, imageUrl } from "@/lib/image";
import { AsteriskMark } from "./asterisk-mark";
import { HeroDrop } from "./hero-drop";
import { Magnetic } from "./motion";
import { btnOutline, btnSolid } from "./ui";

/** Conversion-focused hero. Scroll drift/spin is CSS `scroll()` timeline
 *  (compositor-only) so the main thread stays free for 120Hz scrolling. */
export async function HomeHero({ shopEnabled }: { shopEnabled: boolean }) {
  const [copy, drop] = await Promise.all([
    fetchContent("home-hero"),
    fetchDrop(),
  ]);
  const eyebrow = contentText(copy, "eyebrow", "Tbilisi — est. 2026");
  const tagline = contentText(
    copy,
    "tagline",
    "Essential clothing. Nothing extra. Heavy fabric, hard cuts, one mark — made to be worn until it falls apart.",
  );
  const primaryCta = contentText(copy, "primaryCta", "Shop the drop");
  const secondaryCta = contentText(copy, "secondaryCta", "See the archive");
  const coordinates = contentText(
    copy,
    "coordinates",
    "[ 41.7151° N, 44.8271° E — Tbilisi ]",
  );
  const image = contentText(copy, "image", "/hero-cat.jpg");
  // `next/image` optimises files it is allowed to fetch; an uploaded backdrop
  // lives on the CDN, which already resizes and re-encodes on delivery.
  const uploaded = image.startsWith("http");

  return (
    <section className="relative flex h-dvh flex-col items-center justify-center overflow-hidden px-6">
      {/* Backdrop sits outside any 3D/transform context so the filtered
          photograph is painted once and composited while the copy drifts. */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        {uploaded ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(image, 1920, "detail")}
            srcSet={imageSrcSet(image, DETAIL_WIDTHS, "detail") || undefined}
            sizes="100vw"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="hero-photo absolute inset-0 size-full object-cover object-bottom"
          />
        ) : (
          <Image
            src={image}
            alt=""
            fill
            sizes="100vw"
            priority
            quality={65}
            className="hero-photo object-cover object-bottom"
          />
        )}
        <div className="hero-scrim absolute inset-0" />
      </div>

      {/* Corner crosshairs */}
      <span aria-hidden="true" className="absolute left-4 top-4 select-none text-sm text-muted sm:left-6 sm:top-6">+</span>
      <span aria-hidden="true" className="absolute right-4 top-4 select-none text-sm text-muted sm:right-6 sm:top-6">+</span>
      <span aria-hidden="true" className="absolute bottom-4 left-4 select-none text-sm text-muted sm:bottom-6 sm:left-6">+</span>
      <span aria-hidden="true" className="absolute bottom-4 right-4 select-none text-sm text-muted sm:bottom-6 sm:right-6">+</span>

      <div className="hero-copy relative flex flex-col items-center text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-muted">
          {eyebrow}
        </p>
        <div className="mt-6 flex items-center gap-4 sm:gap-6">
          <span className="hero-asterisk">
            <AsteriskMark className="size-14 sm:size-24" />
          </span>
          <h1 className="text-7xl uppercase leading-none tracking-tight sm:text-9xl">
            Stiff
          </h1>
        </div>
        <p className="mt-6 max-w-md text-sm leading-7 text-muted">
          {tagline}
        </p>

        {/* Between the pitch and the buttons: the clock is the reason to act,
            so it sits where the eye already is on its way to the CTA. */}
        {drop && <HeroDrop drop={drop} />}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {shopEnabled && (
            <Magnetic className="inline-block">
              <Link
                href="/clothing"
                className={`${btnSolid} active:scale-[0.98]`}
              >
                {primaryCta}
              </Link>
            </Magnetic>
          )}
          <Magnetic className="inline-block">
            <Link
              href="/gallery"
              className={`${btnOutline} h-12 px-6 active:scale-[0.98]`}
            >
              {secondaryCta}
            </Link>
          </Magnetic>
        </div>
        <p className="mt-10 text-[10px] font-medium uppercase tracking-[0.25em] text-muted">
          {coordinates}
        </p>
      </div>
    </section>
  );
}
