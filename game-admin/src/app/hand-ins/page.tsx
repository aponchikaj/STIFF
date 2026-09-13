import type { Metadata } from "next";
import { HandInsTab } from "@/components/game/hand-ins-tab";

export const metadata: Metadata = { title: "Hand-ins" };

export default function Page() {
  return <HandInsTab />;
}
