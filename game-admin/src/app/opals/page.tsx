import type { Metadata } from "next";
import { OpalsTab } from "@/components/game/opals-tab";

export const metadata: Metadata = { title: "Opal packs" };

export default function Page() {
  return <OpalsTab />;
}
