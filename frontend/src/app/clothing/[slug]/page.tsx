import type { Metadata } from "next";
import { ProductView } from "./product-view";

export const metadata: Metadata = { title: "Clothing — STIFF" };

export default async function ProductPage({
  params,
}: PageProps<"/clothing/[slug]">) {
  const { slug } = await params;
  return <ProductView slug={slug} />;
}
