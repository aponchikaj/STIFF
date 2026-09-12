import type { Metadata } from "next";
import { PlayersTab } from "@/components/game/players-tab";

export const metadata: Metadata = { title: "Players" };

export default function Page() {
  return <PlayersTab />;
}
