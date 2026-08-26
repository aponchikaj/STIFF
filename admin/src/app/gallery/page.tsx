import type { Metadata } from "next";
import { GalleryTab } from "@/components/admin/gallery-tab";

export const metadata: Metadata = { title: "Gallery" };

export default function Page() {
  return (
    <section className="py-10">
      <GalleryTab />
    </section>
  );
}
