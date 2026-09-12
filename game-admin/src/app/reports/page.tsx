import type { Metadata } from "next";
import { ReportsTab } from "@/components/game/reports-tab";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return (
    <section className="py-10">
      <ReportsTab />
    </section>
  );
}
