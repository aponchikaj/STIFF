import type { Metadata } from "next";
import { DmView } from "./dm-view";

export const metadata: Metadata = { title: "Message" };

export default function DmPage() {
  return <DmView />;
}
