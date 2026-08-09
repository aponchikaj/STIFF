import type { Metadata } from "next";
import { NotificationsView } from "./notifications-view";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false },
};

export default function NotificationsPage() {
  return (
    <section className="w-full flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <NotificationsView />
    </section>
  );
}
