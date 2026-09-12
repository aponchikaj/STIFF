import type { Metadata } from "next";
import { ShopTab } from "@/components/game/shop-tab";

export const metadata: Metadata = { title: "Coin shop" };

export default function Page() {
  return <ShopTab />;
}
