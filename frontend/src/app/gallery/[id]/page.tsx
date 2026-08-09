import type { Metadata } from "next";
import { GalleryItemView } from "./gallery-item-view";

export const metadata: Metadata = { title: "Gallery — STIFF" };

export default async function GalleryItemPage({
  params,
}: PageProps<"/gallery/[id]">) {
  const { id } = await params;
  return <GalleryItemView id={id} />;
}
