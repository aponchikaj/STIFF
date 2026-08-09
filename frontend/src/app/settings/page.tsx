import type { Metadata } from "next";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
};

export default function SettingsPage() {
  return (
    <section className="w-full flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <SettingsView />
    </section>
  );
}
