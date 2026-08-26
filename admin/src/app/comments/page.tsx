import type { Metadata } from "next";
import { CommentsTab } from "@/components/admin/comments-tab";

export const metadata: Metadata = { title: "Comments" };

export default function Page() {
  return (
    <section className="py-10">
      <CommentsTab />
    </section>
  );
}
