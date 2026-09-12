import type { Metadata } from "next";
import { ContentTab } from "@/components/admin/content-tab";

export const metadata: Metadata = { title: "Content" };

export default function Page() {
  return <ContentTab />;
}
