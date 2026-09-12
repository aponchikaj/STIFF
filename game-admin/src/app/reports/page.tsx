import type { Metadata } from "next";
import { ReportsTab } from "@/components/game/reports-tab";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <ReportsTab />;
}
