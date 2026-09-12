import type { Metadata } from "next";
import { ProductsTab } from "@/components/admin/products-tab";

export const metadata: Metadata = { title: "Products" };

export default function Page() {
  return <ProductsTab />;
}
