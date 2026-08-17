import type { Metadata } from "next";
import { MessagesView } from "./messages-view";

export const metadata: Metadata = { title: "Direct" };

export default function MessagesPage() {
  return <MessagesView />;
}
