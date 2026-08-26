import type { Metadata } from "next";
import { OrdersTab } from "@/components/admin/orders-tab";

export const metadata: Metadata = { title: "Orders" };

export default function Page() {
  return (
    <section className="py-10">
      <OrdersTab />
    </section>
  );
}
