import type { Metadata } from "next";
import { GameShopTab } from "@/components/admin/game-shop-tab";

export const metadata: Metadata = { title: "Game shop" };

export default function Page() {
  return <GameShopTab />;
}
