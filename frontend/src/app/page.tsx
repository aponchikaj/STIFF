import type { Metadata } from "next";
import Link from "next/link";
import { AboutTeaser } from "@/components/about-teaser";
import { AsteriskMark } from "@/components/asterisk-mark";
import { CategoryRows } from "@/components/category-rows";
import { DropSignup } from "@/components/drop-signup";
import { FeaturedProducts } from "@/components/featured-products";
import { GalleryPreview } from "@/components/gallery-preview";
import { HomeHero } from "@/components/home-hero";
import { InstagramStrip } from "@/components/instagram-strip";
import { IfGuest } from "@/components/if-shop";
import { IntroOverlay } from "@/components/intro-overlay";
import { MarqueeBand } from "@/components/marquee-band";
import { Magnetic, Parallax, Reveal } from "@/components/motion";
import { ProductCarousel } from "@/components/product-carousel";
import { SectionTracker } from "@/components/section-tracker";
import { sectionNumbers } from "@/lib/home-sections";
import {
  contentList,
  contentText,
  fetchContent,
  fetchInstagram,
} from "@/lib/content-server";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const outlineBtn =
  "flex h-10 items-center rounded-[2px] border border-subtle px-5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted";

const solidBtn =
  "flex h-12 items-center rounded-[2px] bg-foreground px-8 text-xs font-bold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const VALUES = [
  {
    title: "Essential",
    body: "Every piece earns its place. If it doesn't add anything, it doesn't ship.",
  },
  {
    title: "Heavy",
    body: "Weight is a feature. Thick cotton, dense embroidery, hardware that clicks.",
  },
  {
    title: "Ours",
    body: "Designed and worn in Tbilisi first. The asterisk is the spark.",
  },
];

const eyebrowCls =
  "text-[11px] font-medium uppercase tracking-[0.2em] text-muted";

export default async function Home() {
  const [features, sectionCopy, valuesCopy, joinCopy, instagram] =
    await Promise.all([
      fetchContent("features"),
      fetchContent("home-sections"),
      fetchContent("home-values"),
      fetchContent("home-join"),
      fetchInstagram(),
    ]);

  /**
   * Read on the server rather than from the client session.
   *
   * The shop-gated acts used to be wrapped in a client component that returned
   * null once the session arrived, so the markup always contained them and the
   * numbering had to guess. Deciding here means a closed shop simply does not
   * render those sections, and the numbers are counted off what does.
   */
  const shopEnabled = features.shopEnabled !== false;
  const no = sectionNumbers(shopEnabled);

  const say = (field: string, fallback: string) =>
    contentText(sectionCopy, field, fallback);

  const valuesEyebrow = contentText(
    valuesCopy,
    "eyebrow",
    "The rules we live by",
  );
  const values = contentList(valuesCopy, "items", VALUES);
  const joinTitle = contentText(joinCopy, "title", "Never miss a drop");
  const joinBody = contentText(
    joinCopy,
    "body",
    "Make an account to get notified the second a drop lands, track your orders, and have your say in the comments.",
  );

  return (
    <>
      <IntroOverlay enabled={features.introOverlay !== false} />
      <HomeHero shopEnabled={shopEnabled} />
      <MarqueeBand />

      {shopEnabled && (
        <>
          {/* The drop: auto-moving product strip */}
          <SectionTracker label="drop">
            <section
              aria-label={say("dropLabel", "The drop")}
              className="w-full px-4 py-20 sm:px-6 sm:py-24"
            >
              <Reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5">
                <div>
                  <p className={eyebrowCls}>
                    {no("drop")} — {say("dropLabel", "The drop")}
                  </p>
                  <h2 className="mt-2 text-3xl uppercase tracking-tight sm:text-5xl">
                    {say("dropHeading", "Latest pieces")}
                  </h2>
                </div>
                <Magnetic>
                  <Link href="/clothing" className={outlineBtn}>
                    {say("dropCta", "Shop all")}
                  </Link>
                </Magnetic>
              </Reveal>
              <Reveal delay={0.1}>
                <ProductCarousel />
              </Reveal>
            </section>
          </SectionTracker>

          {/* Most wanted */}
          <SectionTracker label="wanted">
            <section
              aria-label={say("wantedLabel", "Most wanted")}
              className="w-full border-t border-subtle px-4 py-20 sm:px-6 sm:py-24"
            >
              <Reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5">
                <div>
                  <p className={eyebrowCls}>
                    {no("wanted")} — {say("wantedLabel", "Most wanted")}
                  </p>
                  <h2 className="mt-2 text-3xl uppercase tracking-tight sm:text-5xl">
                    {say("wantedHeading", "What everyone likes")}
                  </h2>
                </div>
                <Magnetic>
                  <Link href="/clothing?sort=popular" className={outlineBtn}>
                    {say("wantedCta", "See all")}
                  </Link>
                </Magnetic>
              </Reveal>
              <FeaturedProducts count={8} />
            </section>
          </SectionTracker>

          {/* Categories as full-bleed rows */}
          <SectionTracker label="categories">
            <section
              aria-label={say("categoriesLabel", "Shop by category")}
              className="border-t border-subtle"
            >
              <Reveal className="w-full px-4 pb-8 pt-16 sm:px-6">
                <p className={eyebrowCls}>
                  {no("categories")} —{" "}
                  {say("categoriesLabel", "Shop by category")}
                </p>
              </Reveal>
              <CategoryRows />
            </section>
          </SectionTracker>
        </>
      )}

      {/* The archive */}
      <SectionTracker label="archive">
        <section
          aria-label={say("archiveLabel", "The archive")}
          className="w-full border-t border-subtle px-4 py-20 sm:px-6 sm:py-24"
        >
          <Reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5">
            <div>
              <p className={eyebrowCls}>
                {no("archive")} — {say("archiveLabel", "The archive")}
              </p>
              <h2 className="mt-2 text-3xl uppercase tracking-tight sm:text-5xl">
                {say("archiveHeading", "Worn, shot, kept")}
              </h2>
            </div>
            <Magnetic>
              <Link href="/gallery" className={outlineBtn}>
                {say("archiveCta", "Full gallery")}
              </Link>
            </Magnetic>
          </Reveal>
          <GalleryPreview />
        </section>
      </SectionTracker>

      {/* Brand statement, admin-editable */}
      <SectionTracker label="idea">
        <section className="overflow-hidden border-y border-subtle bg-surface">
          <Parallax
            range={28}
            className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-32"
          >
            <Reveal>
              <p className={eyebrowCls}>
                {no("idea")} — {say("ideaLabel", "The idea")}
              </p>
              <div className="mt-4">
                <AboutTeaser />
              </div>
              <Magnetic className="mt-8 inline-block">
                <Link href="/about" className={solidBtn}>
                  {say("ideaCta", "Our story")}
                </Link>
              </Magnetic>
            </Reveal>
          </Parallax>
        </section>
      </SectionTracker>

      {/* What we stand for: inverted black band */}
      <SectionTracker label="values">
        <section
          aria-label={valuesEyebrow}
          className="theme-invert w-full bg-background px-4 py-20 text-foreground sm:px-6 sm:py-24"
        >
          <Reveal>
            <p className={`text-center ${eyebrowCls}`}>
              {no("values")} — {valuesEyebrow}
            </p>
          </Reveal>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {values.map((value, i) => (
              <Reveal
                key={value.title}
                delay={i * 0.08}
                className="flex flex-col items-center text-center"
              >
                <AsteriskMark className="size-5 text-muted" />
                <h3 className="mt-4 font-display text-2xl uppercase tracking-tight sm:text-3xl">
                  {value.title}
                </h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-muted">
                  {value.body}
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10 flex justify-center">
            <Link
              href="/rules"
              className="rounded-[2px] text-[11px] font-medium uppercase tracking-[0.2em] text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
            >
              {say("valuesCta", "Read all the rules →")}
            </Link>
          </Reveal>
        </section>
      </SectionTracker>

      {/* The brand's day-to-day, before the ask */}
      <SectionTracker label="instagram">
        <InstagramStrip
          strip={instagram}
          eyebrow={say("instagramLabel", "Day to day")}
        />
      </SectionTracker>

      {/* Join: the reason to come back */}
      <SectionTracker label="join">
        <section className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-28">
          <Reveal>
            <h2 className="text-4xl uppercase leading-none tracking-tight sm:text-6xl">
              {joinTitle}
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-muted">
              {joinBody}
            </p>
            <DropSignup />
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {shopEnabled && (
                <Magnetic className="inline-block">
                  <Link href="/clothing" className={solidBtn}>
                    {say("dropCta", "Shop all")}
                  </Link>
                </Magnetic>
              )}
              <IfGuest>
                <Magnetic className="inline-block">
                  <Link href="/register" className={`${outlineBtn} h-12 px-6`}>
                    Create account
                  </Link>
                </Magnetic>
              </IfGuest>
            </div>
          </Reveal>
        </section>
      </SectionTracker>

      <MarqueeBand />
    </>
  );
}
