import type { Metadata } from "next";
import { OverviewTab } from "@/components/admin/overview-tab";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <OverviewTab />;
}
