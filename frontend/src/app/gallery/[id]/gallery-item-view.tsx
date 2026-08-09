"use client";

import Link from "next/link";
import { galleryApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import { CommentsSection } from "@/components/comments-section";
import { ProductImage } from "@/components/product-image";
import { ReactionButtons } from "@/components/reaction-buttons";
import { btnOutline, Loading } from "@/components/ui";

export function GalleryItemView({ id }: { id: string }) {
  const { data: item, loading, error } = useAsync(
    () => galleryApi.getGalleryItem(id),
    [id],
  );

  if (loading) {
    return (
      <section className="flex w-full justify-center px-4 py-12 sm:px-6">
        <Loading label="Loading" />
      </section>
    );
  }

  if (error || !item) {
    return (
      <section className="flex w-full flex-col items-start gap-6 px-4 py-24 sm:px-6">
        <h1 className="text-4xl uppercase tracking-tight sm:text-5xl">
          Not found
        </h1>
        <p className="text-sm text-muted">
          {error ?? "This shot doesn't exist or was removed."}
        </p>
        <Link href="/gallery" className={btnOutline}>
          Back to gallery
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className="mx-auto grid w-full max-w-4xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-14">
        <div className="mx-auto w-full max-w-[400px] lg:mx-0">
          <ProductImage src={item.imageUrl} alt={item.title} aspect="" />
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {formatDate(item.createdAt)}
          </p>
          <h1 className="mt-2 text-4xl uppercase tracking-tight sm:text-5xl">
            {item.title}
          </h1>
          {item.description && (
            <p className="mt-6 max-w-md text-sm leading-6 text-muted">
              {item.description}
            </p>
          )}
          <div className="mt-6">
            <ReactionButtons
              targetType="gallery"
              targetId={item.id}
              likeCount={item.likeCount}
              dislikeCount={item.dislikeCount}
              myReaction={item.myReaction}
            />
          </div>
          <Link href="/gallery" className={`${btnOutline} mt-8 inline-flex`}>
            Back to gallery
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
        <CommentsSection targetType="gallery" targetId={item.id} />
      </section>
    </>
  );
}
