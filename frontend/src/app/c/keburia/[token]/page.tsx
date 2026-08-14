import type { Metadata } from "next";
import { TokenStash } from "./token-stash";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "STIFF" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
  referrer: "no-referrer",
  openGraph: {
    title: "STIFF",
    description: " ",
    url: "https://stiff.ge",
  },
};

export default async function CollabTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <TokenStash token={token} />;
}
