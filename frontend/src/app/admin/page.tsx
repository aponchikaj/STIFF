import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Loading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

export default function AdminPage() {
  return (
    <section className="w-full flex-1 px-4 py-12 sm:px-6 sm:py-16">
      {/* AdminPanel reads the active tab from the query string, which needs a
          Suspense boundary to prerender. */}
      <Suspense fallback={<Loading label="Loading admin" />}>
        <AdminPanel />
      </Suspense>
    </section>
  );
}
