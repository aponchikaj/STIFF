import type { Metadata } from "next";
import { OrderReceipt } from "./order-receipt";

/**
 * A receipt is personal and reachable by anyone holding the id, so it must
 * never be indexed — the same reasoning as the collab pages.
 */
export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false, nocache: true },
};

export default async function OrderPage({
  params,
}: PageProps<"/orders/[id]">) {
  const { id } = await params;
  return <OrderReceipt id={id} />;
}
