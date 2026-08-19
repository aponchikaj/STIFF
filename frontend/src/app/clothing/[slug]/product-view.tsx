"use client";

import Link from "next/link";
import { useState } from "react";
import { productsApi } from "@/lib/api";
import type { ProductDetail } from "@/lib/api";
import { useContent } from "@/lib/content";
import { formatPrice } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import { CommentsSection } from "@/components/comments-section";
import { AsteriskMark } from "@/components/asterisk-mark";
import { ShopClosed } from "@/components/if-shop";
import { Lightbox } from "@/components/lightbox";
import { Reveal } from "@/components/motion";
import { useSession } from "@/components/providers";
import { ProductCard } from "@/components/product-card";
import { ProductControls } from "@/components/product-controls";
import { ProductImage } from "@/components/product-image";
import { ReactionButtons } from "@/components/reaction-buttons";
import { ShareButton } from "@/components/share-button";
import { productShareSubject } from "@/lib/share-subject";
import { btnOutline, Loading } from "@/components/ui";

/**
 * Headline scarcity, across every size.
 *
 * Deliberately blunter than the per-size warning in `ProductControls`: this one
 * says the piece is nearly gone, that one says which size is. Both read their
 * threshold from Content -> Storefront thresholds.
 */

export function ProductView({
  slug,
  initial = null,
}: {
  slug: string;
  initial?: ProductDetail | null;
}) {
  const storefront = useContent("storefront");
  const lowStockThreshold = Number(storefront.text("lowStockThreshold", "3"));
  const lowStockLabel = storefront.text("lowStockLabel", "Only {n} left");
  const { shopEnabled } = useSession();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const { data: product, loading, error } = useAsync(
    () => productsApi.getProduct(slug),
    [slug],
    initial,
  );
  const { data: related } = useAsync(
    () => productsApi.listProducts({ pageSize: 5, sort: "popular" }),
    [slug],
  );

  if (!shopEnabled) return <ShopClosed />;

  if (loading && !product) {
    return (
      <section className="flex w-full justify-center px-4 py-12 sm:px-6">
        <Loading label="Loading piece" />
      </section>
    );
  }

  if (error || !product) {
    return (
      <section className="flex w-full flex-col items-start gap-6 px-4 py-24 sm:px-6">
        <h1 className="text-4xl uppercase tracking-tight sm:text-5xl">
          Not found
        </h1>
        <p className="text-sm text-muted">
          {error ?? "This piece doesn't exist or was removed."}
        </p>
        <Link href="/clothing" className={btnOutline}>
          Back to clothing
        </Link>
      </section>
    );
  }

  const gallery = product.images.length > 0 ? product.images : [null];
  const shareSubject = productShareSubject(product);
  const relatedItems = (related?.items ?? [])
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  return (
    <>
      {lightbox && (
        <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      )}
      <section className="mx-auto grid w-full max-w-4xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-14">
        {/* Mobile: swipeable snap carousel; desktop: stacked scroll gallery */}
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto lg:flex-col lg:overflow-visible">
          {gallery.map((src, i) => (
            <div
              key={i}
              className="w-[70%] max-w-[340px] shrink-0 snap-center sm:w-[45%] lg:w-full lg:max-w-none"
            >
              <button
                type="button"
                aria-label={src ? "Open full-size image" : undefined}
                disabled={!src}
                onClick={() => src && setLightbox(src)}
                className="group block w-full cursor-zoom-in overflow-hidden rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:cursor-default"
              >
                <ProductImage
                  src={src}
                  alt={`${product.name} — view ${i + 1}`}
                  sizes="(min-width: 1024px) 400px, (min-width: 640px) 45vw, 70vw"
                  priority={i === 0}
                  fit="detail"
                  iconClassName="size-12 text-subtle"
                  className="transition-opacity duration-200 group-hover:opacity-90"
                />
              </button>
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {product.category ?? "Stiff"}
          </p>
          <h1 className="mt-2 text-4xl uppercase tracking-tight sm:text-5xl">
            {product.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-lg text-muted">
              {formatPrice(product.priceCents)}
            </p>
            {product.stock > 0 && product.stock <= lowStockThreshold && (
              <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                <AsteriskMark className="size-3.5" />
                {lowStockLabel.replace("{n}", String(product.stock))}
              </span>
            )}
          </div>
          {product.description && (
            <p className="mt-6 max-w-md text-sm leading-6 text-muted">
              {product.description}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <ReactionButtons
              targetType="product"
              targetId={product.id}
              likeCount={product.likeCount}
              dislikeCount={product.dislikeCount}
              myReaction={product.myReaction}
            />
            {shareSubject && <ShareButton subject={shareSubject} />}
          </div>
          <ProductControls product={product} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        <CommentsSection targetType="product" targetId={product.id} />
      </section>

      {relatedItems.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
          <Reveal>
            <h2 className="text-2xl uppercase tracking-tight sm:text-4xl">
              More like this
            </h2>
          </Reveal>
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {relatedItems.map((p) => (
              <li key={p.id} className="cv-auto">
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
