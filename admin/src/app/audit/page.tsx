import type { Metadata } from "next";
import { AuditTab } from "@/components/admin/audit-tab";

export const metadata: Metadata = { title: "Audit" };

export default function Page() {
  return (
    <section className="py-10">
      <AuditTab />
    </section>
  );
}
