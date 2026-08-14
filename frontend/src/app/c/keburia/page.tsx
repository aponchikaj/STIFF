import type { Metadata } from "next";
import { CollabExperience } from "@/components/collab/collab-experience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "STIFF" },
  description: undefined,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  referrer: "no-referrer",
  openGraph: {
    title: "STIFF",
    description: " ",
    url: "https://stiff.ge",
  },
  twitter: {
    card: "summary",
    title: "STIFF",
    description: " ",
  },
};

export default function CollabPage() {
  return <CollabExperience />;
}
