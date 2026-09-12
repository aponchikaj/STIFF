import type { Metadata } from "next";
import { BoardTab } from "@/components/game/board-tab";

export const metadata: Metadata = { title: "Board" };

export default function Page() {
  return <BoardTab />;
}
