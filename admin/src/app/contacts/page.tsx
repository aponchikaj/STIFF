import type { Metadata } from "next";
import { ContactsTab } from "@/components/admin/contacts-tab";

export const metadata: Metadata = { title: "Contacts" };

export default function Page() {
  return (
    <section className="py-10">
      <ContactsTab />
    </section>
  );
}
