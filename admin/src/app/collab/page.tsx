import type { Metadata } from "next";
import { CollabTab } from "@/components/admin/collab-tab";

export const metadata: Metadata = { title: "Collab" };

export default function Page() {
  return (
    <section className="py-10">
      <CollabTab />
    </section>
  );
}
