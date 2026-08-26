import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_URL } from "@/lib/admin-site";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * The panel moved to its own origin. This is kept so the bookmarks and links
 * that already exist keep landing somewhere useful.
 *
 * A temporary redirect, not a permanent one: 308s stick in browser caches for
 * a long time, and the destination is environment-dependent.
 */
export default function AdminPage(): never {
  redirect(ADMIN_URL);
}
