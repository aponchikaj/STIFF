"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "../providers";
import { chipCls, Loading } from "../ui";
import { OverviewTab } from "./overview-tab";
import { TrafficTab } from "./traffic-tab";
import { ProductsTab } from "./products-tab";
import { OrdersTab } from "./orders-tab";
import { UsersTab } from "./users-tab";
import { CommentsTab } from "./comments-tab";
import { ContactsTab } from "./contacts-tab";
import { GalleryTab } from "./gallery-tab";
import { ContentTab } from "./content-tab";
import { CollabTab } from "./collab-tab";
import { BroadcastTab } from "./broadcast-tab";

/**
 * Tabs live in the URL rather than component state, so an admin view can be
 * bookmarked, shared with whoever is handling it, and survives a refresh —
 * which matters now that Returns is somewhere two people hand work between.
 */
const TABS = [
  { slug: "overview", label: "Overview", render: () => <OverviewTab /> },
  { slug: "traffic", label: "Traffic", render: () => <TrafficTab /> },
  { slug: "products", label: "Products", render: () => <ProductsTab /> },
  { slug: "orders", label: "Orders", render: () => <OrdersTab /> },
  { slug: "users", label: "Users", render: () => <UsersTab /> },
  { slug: "comments", label: "Comments", render: () => <CommentsTab /> },
  { slug: "contacts", label: "Contacts", render: () => <ContactsTab /> },
  { slug: "gallery", label: "Gallery", render: () => <GalleryTab /> },
  { slug: "content", label: "Content", render: () => <ContentTab /> },
  { slug: "collab", label: "Collab", render: () => <CollabTab /> },
  { slug: "broadcast", label: "Broadcast", render: () => <BroadcastTab /> },
] as const;

const DEFAULT_TAB = TABS[0].slug;

export function AdminPanel() {
  const { user, loading } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const requested = searchParams.get("tab");
  const active =
    TABS.find((tab) => tab.slug === requested) ??
    TABS.find((tab) => tab.slug === DEFAULT_TAB)!;

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace(user ? "/" : "/login?next=/admin");
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== "admin") {
    return <Loading label="Loading admin" />;
  }

  function select(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (slug === DEFAULT_TAB) params.delete("tab");
    else params.set("tab", slug);
    const query = params.toString();
    // Replace, not push: flicking between tabs should not fill up the back
    // button with places the admin never meant to return to.
    router.replace(query ? `/admin?${query}` : "/admin", { scroll: false });
  }

  return (
    <div>
      <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">Admin</h1>
      <div
        role="tablist"
        aria-label="Admin sections"
        className="-mx-4 mt-8 flex gap-1.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {TABS.map((tab) => (
          <button
            key={tab.slug}
            type="button"
            role="tab"
            aria-selected={active.slug === tab.slug}
            onClick={() => select(tab.slug)}
            className={`${chipCls(active.slug === tab.slug)} shrink-0`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-8">{active.render()}</div>
    </div>
  );
}
