import type { Metadata } from "next";
import { NotFoundScreen } from "@/components/not-found-screen";

export const metadata: Metadata = {
  title: "404",
};

/** Any URL the app does not know. The screen itself is in the component. */
export default function NotFound() {
  return <NotFoundScreen />;
}
