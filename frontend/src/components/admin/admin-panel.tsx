"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

const TABS = [
  "Overview",
  "Traffic",
  "Products",
  "Orders",
  "Users",
  "Comments",
  "Contacts",
  "Gallery",
  "Content",
  "Collab",
  "Broadcast",
] as const;

type Tab = (typeof TABS)[number];

export function AdminPanel() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace(user ? "/" : "/login?next=/admin");
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== "admin") {
    return <Loading label="Loading admin" />;
  }

  return (
    <div>
      <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">Admin</h1>
      <div
        role="tablist"
        aria-label="Admin sections"
        className="-mx-4 mt-8 flex gap-1.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`${chipCls(tab === t)} shrink-0`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-8">
        {tab === "Overview" && <OverviewTab />}
        {tab === "Traffic" && <TrafficTab />}
        {tab === "Products" && <ProductsTab />}
        {tab === "Orders" && <OrdersTab />}
        {tab === "Users" && <UsersTab />}
        {tab === "Comments" && <CommentsTab />}
        {tab === "Contacts" && <ContactsTab />}
        {tab === "Gallery" && <GalleryTab />}
        {tab === "Content" && <ContentTab />}
        {tab === "Collab" && <CollabTab />}
        {tab === "Broadcast" && <BroadcastTab />}
      </div>
    </div>
  );
}
