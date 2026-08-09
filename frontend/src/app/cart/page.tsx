import type { Metadata } from "next";
import { CartView } from "./cart-view";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false },
};

export default function CartPage() {
  return (
    <section className="w-full flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <CartView />
    </section>
  );
}
