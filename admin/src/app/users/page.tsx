import type { Metadata } from "next";
import { UsersTab } from "@/components/admin/users-tab";

export const metadata: Metadata = { title: "Users" };

export default function Page() {
  return (
    <section className="py-10">
      <UsersTab />
    </section>
  );
}
