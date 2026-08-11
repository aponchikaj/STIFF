import type { Metadata } from "next";
import { galleryApi } from "@/lib/api";
import { galleryPath } from "@/lib/gallery-url";
import { imageUrl } from "@/lib/image";
import { GalleryItemView } from "./gallery-item-view";

/**
 * Resolved on the server so a shared link previews the actual photograph
 * instead of the generic site card. A failure here must not break the page —
 * the client view renders its own not-found state.
 */
export async function generateMetadata({
  params,
}: PageProps<"/gallery/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const item = await galleryApi.getGalleryItem(slug);
    const title = `${item.title} — Archive`;
    const description =
      item.description ??
      `Shot ${item.title} from the STIFF archive — worn, shot, kept.`;
    const image = imageUrl(item.imageUrl, 1200);
    const path = galleryPath(item);

    return {
      title,
      description,
      alternates: { canonical: path },
      openGraph: {
        type: "article",
        title,
        description,
        url: path,
        images: [{ url: image, alt: item.title }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return { title: "Gallery" };
  }
}

export default async function GalleryItemPage({
  params,
}: PageProps<"/gallery/[slug]">) {
  const { slug } = await params;
  return <GalleryItemView slug={slug} />;
}
