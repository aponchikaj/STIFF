import type { Metadata } from "next";
import { TrafficTab } from "@/components/admin/traffic-tab";

export const metadata: Metadata = { title: "Traffic" };

export default function Page() {
  return <TrafficTab />;
}
