import type { Metadata } from "next";
import { AdminPanel } from "@/components/admin/admin-panel";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

export default function AdminPage() {
  return (
    <section className="w-full flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <AdminPanel />
    </section>
  );
}
