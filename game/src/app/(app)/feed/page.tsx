"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { Reel } from "@/components/reel/reel";
import { Empty, Loading } from "@/components/ui";
import type { FeedItem } from "@/lib/api";
import { useFeedItem, useFeedItems } from "@/lib/queries";

/**
 * `/feed` — what everyone handed in, as a reel.
 *
 * Public: the screen that sells the game, so it has to be complete for
 * someone who has never signed in. Full-screen, one post per swipe, the
 * clip playing as soon as it is on screen. The app's own bars float over
 * it; nothing else does — no filters, no headings.
 *
 *   ?v=<id>          open on that post (the URL keeps up as you scroll)
 *   ?player=<handle> only that player's posts — what their profile opens
 */
export default function FeedPage() {
  return (
    <Suspense fallback={<Center><Loading label="LOADING THE FEED" /></Center>}>
      <FeedScreen />
    </Suspense>
  );
}

function FeedScreen() {
  const params = useSearchParams();
  const startId = params.get("v");
  const player = params.get("player")?.trim() || undefined;

  const feed = useFeedItems({ limit: 8, player });

  // A link to a post that is not on the first page (an old one, a shared
  // one): fetch it on its own and put it first, so the reel opens on it.
  const loaded = feed.items.some((i) => i.id === startId);
  const single = useFeedItem(startId ?? "", Boolean(startId) && !feed.isLoading && !loaded);

  const items = useMemo<FeedItem[]>(() => {
    const extra = single.data && !loaded ? [single.data] : [];
    const seen = new Set<string>();
    return [...extra, ...feed.items].filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
  }, [feed.items, single.data, loaded]);

  if (feed.isLoading) {
    return (
      <Center>
        <Loading label="LOADING THE FEED" />
      </Center>
    );
  }

  return (
    <Reel
      items={items}
      hasMore={Boolean(feed.hasNextPage)}
      loadingMore={feed.isFetchingNextPage}
      onLoadMore={() => void feed.fetchNextPage()}
      startId={startId}
      topLeft={
        player ? (
          <Link
            href={`/u/${encodeURIComponent(player)}`}
            className="inline-flex items-center gap-2 bg-void/55 px-3 py-2 font-pixel text-[9px] uppercase tracking-[0.12em] text-ink backdrop-blur-sm frame-notch hover:text-cyan"
          >
            ◀ @{player}
          </Link>
        ) : null
      }
      empty={
        <Empty icon="live" title={player ? "No posts yet" : "Nothing published yet"}>
          {player
            ? "Nothing of theirs has been judged and published yet."
            : "Hand-ins appear here once the watchers have judged them."}
        </Empty>
      }
    />
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-[70dvh] items-center justify-center">{children}</main>;
}
