/**
 * Query keys, in one place.
 *
 * Hierarchical on purpose: `queryKeys.feed.all` invalidates every page and
 * every filter of the feed in one call, which is what a new publish needs,
 * while `queryKeys.feed.item(id)` touches exactly one card. Spelling keys
 * inline at each call site is how a mutation ends up invalidating four of
 * the five lists that show the number it just changed.
 */

import type {
  FeedQuery,
  LeaderboardQuery,
  PlayableTasksQuery,
  WarFilter,
} from "@/lib/api";

export const queryKeys = {
  /* Things that change only when the admin changes them. Long stale times. */
  rules: ["rules"] as const,
  health: ["health"] as const,
  season: ["season"] as const,

  /* The signed-in person. */
  me: {
    all: ["me"] as const,
    dashboard: ["me", "dashboard"] as const,
    user: ["me", "user"] as const,
    enrolment: ["me", "enrolment"] as const,
    settings: ["me", "settings"] as const,
    stats: ["me", "stats"] as const,
    attempts: ["me", "attempts"] as const,
    standing: ["me", "standing"] as const,
    purchases: ["me", "purchases"] as const,
    reports: ["me", "reports"] as const,
  },

  assignment: {
    all: ["assignment"] as const,
    current: ["assignment", "current"] as const,
  },

  tasks: {
    all: ["tasks"] as const,
    pool: (query: PlayableTasksQuery = {}) => ["tasks", "pool", query] as const,
  },

  feed: {
    all: ["feed"] as const,
    /** `cursor` is excluded — it is the infinite query's page param, not a key. */
    list: (query: Omit<FeedQuery, "cursor"> = {}) => ["feed", "list", query] as const,
    item: (id: string) => ["feed", "item", id] as const,
    comments: (id: string) => ["feed", "item", id, "comments"] as const,
  },

  leaderboard: {
    all: ["leaderboard"] as const,
    board: (query: LeaderboardQuery = {}) => ["leaderboard", "board", query] as const,
    search: (q: string) => ["leaderboard", "search", q] as const,
  },

  clan: {
    all: ["clan"] as const,
    mine: ["clan", "mine"] as const,
  },

  votes: {
    all: ["votes"] as const,
    open: ["votes", "open"] as const,
  },

  shop: {
    all: ["shop"] as const,
    items: ["shop", "items"] as const,
  },

  opals: {
    all: ["opals"] as const,
    list: ["opals", "list"] as const,
    mine: ["opals", "mine"] as const,
  },

  wars: {
    all: ["wars"] as const,
    list: (filter?: WarFilter) => ["wars", "list", filter ?? "all"] as const,
    one: (id: string) => ["wars", "one", id] as const,
  },

  reports: {
    all: ["reports"] as const,
    catalogue: ["reports", "catalogue"] as const,
  },

  notifications: {
    all: ["notifications"] as const,
    list: (query: Record<string, unknown> = {}) =>
      ["notifications", "list", query] as const,
  },
} as const;
