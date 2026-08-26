import type { Metadata } from "next";
import { ContentTab } from "@/components/admin/content-tab";

export const metadata: Metadata = { title: "Content" };

export default function Page() {
  return (
    <section className="py-10">
      <ContentTab />
    </section>
  );
}
