import type { Metadata } from "next";
import { SeasonsTab } from "@/components/game/seasons-tab";

export const metadata: Metadata = { title: "Seasons" };

export default function Page() {
  return (
    <section className="py-10">
      <SeasonsTab />
    </section>
  );
}
