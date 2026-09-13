import type { Metadata } from "next";
import { ClocksTab } from "@/components/game/clocks-tab";

export const metadata: Metadata = { title: "Clocks" };

export default function Page() {
  return <ClocksTab />;
}
