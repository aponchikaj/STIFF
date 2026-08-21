import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeView } from "./unsubscribe-view";

export const metadata: Metadata = {
  title: "Unsubscribed",
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeView />
    </Suspense>
  );
}
