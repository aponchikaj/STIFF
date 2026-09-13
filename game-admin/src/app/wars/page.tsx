import type { Metadata } from "next";
import { WarsTab } from "@/components/game/wars-tab";

export const metadata: Metadata = { title: "Clan wars" };

export default function Page() {
  return <WarsTab />;
}
