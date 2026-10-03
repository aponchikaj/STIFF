"use client";

/**
 * The feed, the board, and player search.
 *
 * All three read without a session. The feed is the thing that makes
 * someone want an account, so every screen here must render for a stranger
 * — which is why `likedByMe` is `null` rather than `false` for one, and why
 * the like button renders as *unknown* rather than *unliked* until there is
 * a session to ask about.
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  gameApi,
  type FeedItem,
  type FeedPage,
  type LeaderboardQuery,
  type LikeOutcome,
  type SeasonDay,
} from "@/lib/api";
import { queryKeys } from "./keys";

/* ----------------------------------------------------------------- feed */

export function useFeed(options: { day?: SeasonDay; limit?: number } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.feed.list(options),
    queryFn: ({ pageParam }) =>
      gameApi.feed({ ...options, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    // The cursor is opaque — never parse it, never construct one.
    getNextPageParam: (last: FeedPage) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

/** Flattens the pages. Infinite queries nest, and nothing downstream cares. */
export function useFeedItems(options: { day?: SeasonDay; limit?: number } = {}) {
  const query = useFeed(options);
  return {
    ...query,
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
  };
}

export function useFeedItem(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.feed.item(id),
    queryFn: () => gameApi.feedItem(id),
    enabled: enabled && Boolean(id),
  });
}

/**
 * Like, optimistically.
 *
 * The heart has to fill under the thumb — a like that waits for a round
 * trip reads as a broken button and gets tapped again. The optimistic write
 * patches every cached copy of the card: the item query *and* each page of
 * every feed list it appears in, because the same attempt is in both and
 * fixing only one leaves two different counts on screen at once.
 */
export function useToggleLike() {
  const qc = useQueryClient();

  type Snapshot = [readonly unknown[], unknown][];

  return useMutation<LikeOutcome, Error, string, { previous: Snapshot }>({
    mutationFn: (id) => gameApi.toggleLike(id),

    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.feed.all });
      const previous = qc.getQueriesData({
        queryKey: queryKeys.feed.all,
      }) as Snapshot;

      const patch = (item: FeedItem): FeedItem => {
        if (item.id !== id) return item;
        // `likedByMe` is null for an anonymous reader. Treating null as
        // false here would be wrong in general, but a tap only happens with
        // a session, so at this point null means "we had not asked yet".
        const nowLiked = !item.likedByMe;
        return {
          ...item,
          likedByMe: nowLiked,
          likeCount: Math.max(0, item.likeCount + (nowLiked ? 1 : -1)),
        };
      };

      qc.setQueriesData<{ pages: FeedPage[]; pageParams: unknown[] }>(
        { queryKey: queryKeys.feed.all, exact: false },
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map(patch),
            })),
          };
        },
      );

      qc.setQueryData<FeedItem>(queryKeys.feed.item(id), (old) =>
        old ? patch(old) : old,
      );

      return { previous };
    },

    onError: (_error, _id, context) => {
      // Put every cache back exactly as it was. Re-deriving the old count by
      // decrementing would drift if two likes raced.
      context?.previous.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
    },

    onSuccess: (outcome, id) => {
      // Trust the server's count over the optimistic one — other people
      // have been liking it too.
      qc.setQueryData<FeedItem>(queryKeys.feed.item(id), (old) =>
        old
          ? { ...old, likedByMe: outcome.liked, likeCount: outcome.likeCount }
          : old,
      );
    },
  });
}

/** A tap on share, counted. Works signed out, so never gate the sheet. */
export function useRecordShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gameApi.recordShare(id),
    onSuccess: (_outcome, id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.feed.item(id) });
    },
  });
}

/* ------------------------------------------------------------- comments */

export function useComments(attemptId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.feed.comments(attemptId),
    queryFn: () => gameApi.comments(attemptId),
    select: (data) => data.comments,
    enabled: enabled && Boolean(attemptId),
  });
}

export function useAddComment(attemptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => gameApi.addComment(attemptId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.feed.comments(attemptId) });
      // The card shows a comment count, so it is stale too.
      void qc.invalidateQueries({ queryKey: queryKeys.feed.item(attemptId) });
      bumpCommentCount(qc, attemptId, 1);
    },
  });
}

export function useRemoveComment(attemptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => gameApi.removeComment(commentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.feed.comments(attemptId) });
      void qc.invalidateQueries({ queryKey: queryKeys.feed.item(attemptId) });
      bumpCommentCount(qc, attemptId, -1);
    },
  });
}

/**
 * The comment count on every feed page that holds this card.
 *
 * Patched rather than invalidated: refetching the infinite feed to move one
 * number would re-page everything above the reader and jump the scroll —
 * from inside the comment sheet that is open over that very feed.
 */
function bumpCommentCount(
  qc: ReturnType<typeof useQueryClient>,
  attemptId: string,
  delta: number,
) {
  qc.setQueriesData<{ pages: FeedPage[]; pageParams: unknown[] }>(
    { queryKey: queryKeys.feed.all, exact: false },
    (old) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === attemptId
              ? { ...item, commentCount: Math.max(0, item.commentCount + delta) }
              : item,
          ),
        })),
      };
    },
  );
}

/* ---------------------------------------------------------------- board */

export function useLeaderboard(query: LeaderboardQuery = {}) {
  return useQuery({
    queryKey: queryKeys.leaderboard.board(query),
    queryFn: () => gameApi.leaderboard(query),
    staleTime: 20_000,
  });
}

/** Rank plus the rows either side. Signed in only. */
export function useStanding() {
  return useQuery({
    queryKey: queryKeys.me.standing,
    queryFn: gameApi.standing,
    retry: false,
    staleTime: 20_000,
  });
}

/**
 * Player search. Debounce at the call site, not here — the hook cannot know
 * whether the input is a search box or a deep link. The 2-character floor
 * is the API's own minimum restated so a 400 is never fired on a keystroke.
 */
export function usePlayerSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: queryKeys.leaderboard.search(term),
    queryFn: () => gameApi.searchPlayers(term),
    select: (data) => data.players,
    enabled: term.length >= 2,
    staleTime: 60_000,
  });
}
