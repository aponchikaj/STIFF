import type { Metadata } from "next";
import { VotesTab } from "@/components/game/votes-tab";

export const metadata: Metadata = { title: "Votes" };

export default function Page() {
  return <VotesTab />;
}
