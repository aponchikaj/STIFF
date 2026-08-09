import type { Metadata } from "next";
import { AccountView } from "./account-view";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <section className="w-full flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <AccountView />
    </section>
  );
}
