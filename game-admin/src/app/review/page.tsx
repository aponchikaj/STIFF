import type { Metadata } from "next";
import { ReviewTab } from "@/components/game/review-tab";

export const metadata: Metadata = { title: "Review" };

export default function Page() {
  return <ReviewTab />;
}
