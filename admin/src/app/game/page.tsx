import type { Metadata } from "next";
import { GameTab } from "@/components/admin/game-tab";

export const metadata: Metadata = { title: "Game" };

export default function Page() {
  return (
    <section className="py-10">
      <GameTab />
    </section>
  );
}
