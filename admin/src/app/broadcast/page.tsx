import type { Metadata } from "next";
import { BroadcastTab } from "@/components/admin/broadcast-tab";

export const metadata: Metadata = { title: "Broadcast" };

export default function Page() {
  return <BroadcastTab />;
}
