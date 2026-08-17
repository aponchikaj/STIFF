import type { Metadata } from "next";
import { DmView } from "./dm-view";

export const metadata: Metadata = { title: "Direct" };

export default function DmPage() {
  return <DmView />;
}
