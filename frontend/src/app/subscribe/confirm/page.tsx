import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmView } from "./confirm-view";

export const metadata: Metadata = {
  title: "Confirm drop alerts",
  // Reached from a link with a token in it. Nothing here belongs in an index.
  robots: { index: false, follow: false },
};

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmView />
    </Suspense>
  );
}
