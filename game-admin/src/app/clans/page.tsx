import type { Metadata } from "next";
import { ClansTab } from "@/components/game/clans-tab";

export const metadata: Metadata = { title: "Clans" };

export default function Page() {
  return <ClansTab />;
}
