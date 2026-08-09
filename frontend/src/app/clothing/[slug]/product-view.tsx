"use client";

import Link from "next/link";
import { productsApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import { CommentsSection } from "@/components/comments-section";
import { ShopClosed } from "@/components/if-shop";
import { Reveal } from "@/components/motion";
import { useSession } from "@/components/providers";
import { ProductCard } from "@/components/product-card";
import { ProductControls } from "@/components/product-controls";
import { ProductImage } from "@/components/product-image";
import { ReactionButtons } from "@/components/reaction-buttons";
import { btnOutline, Loading } from "@/components/ui";

export function ProductView({ slug }: { slug: string }) {
  const { shopEnabled } = useSession();
  const { data: product, loading, error } = useAsync(
    () => productsApi.getProduct(slug),
    [slug],
  );
  const { data: related } = useAsync(
    () => productsApi.listProducts({ pageSize: 5, sort: "popular" }),
    [slug],
  );

  if (!shopEnabled) return <ShopClosed />;

  if (loading) {
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
  const relatedItems = (related?.items ?? [])
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  return (
    <>
      <section className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-16">
        {/* Mobile: swipeable snap carousel; desktop: stacked scroll gallery */}
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto lg:flex-col lg:overflow-visible">
          {gallery.map((src, i) => (
            <Reveal
              key={i}
              delay={i * 0.08}
              className="w-[82%] shrink-0 snap-center lg:w-full"
            >
              <ProductImage
                src={src}
                alt={`${product.name} — view ${i + 1}`}
                iconClassName="size-12 text-subtle"
              />
            </Reveal>
          ))}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {product.category ?? "Stiff"}
          </p>
          <h1 className="mt-2 text-4xl uppercase tracking-tight sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-3 text-lg text-muted">
            {formatPrice(product.priceCents)}
          </p>
          {product.description && (
            <p className="mt-6 max-w-md text-sm leading-6 text-muted">
              {product.description}
            </p>
          )}
          <div className="mt-6">
            <ReactionButtons
              targetType="product"
              targetId={product.id}
              likeCount={product.likeCount}
              dislikeCount={product.dislikeCount}
              myReaction={product.myReaction}
            />
          </div>
          <ProductControls product={product} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        <CommentsSection targetType="product" targetId={product.id} />
      </section>

      {relatedItems.length > 0 && (
        <section className="w-full px-4 pb-24 sm:px-6">
          <Reveal>
            <h2 className="text-2xl uppercase tracking-tight sm:text-4xl">
              More like this
            </h2>
          </Reveal>
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {relatedItems.map((p, i) => (
              <li key={p.id}>
                <Reveal delay={i * 0.06}>
                  <ProductCard product={p} />
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
