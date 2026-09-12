import type { Metadata } from "next";
import { SeasonsTab } from "@/components/game/seasons-tab";

export const metadata: Metadata = { title: "Seasons" };

export default function Page() {
  return <SeasonsTab />;
}
