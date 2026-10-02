"use client";

/**
 * Clans, voting, the coin shop, clan wars, reports.
 *
 * The thread running through all of these is **coins**. Voting pays them,
 * the shop spends them, a war stakes them, and a clan shares a penalty of
 * them — so nearly every mutation here invalidates the dashboard, which is
 * where the balance is displayed. Missing one of those is how a player ends
 * up buying something and watching their old balance sit there.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clansApi,
  gameApi,
  opalsApi,
  reportsApi,
  shopApi,
  votingApi,
  warsApi,
  type CreateReportInput,
  type OpalPaymentMethod,
  type PlaceBetInput,
  type ProposeWarInput,
  type SeasonDay,
  type VoteValue,
  type WarFilter,
} from "@/lib/api";
import { queryKeys } from "./keys";

/* ---------------------------------------------------------------- clans */

export function useMyClan() {
  return useQuery({
    queryKey: queryKeys.clan.mine,
    queryFn: clansApi.mine,
    select: (data) => data.clan,
    retry: false,
  });
}

/** Everything that changes clan membership touches the dashboard too — the
 *  dashboard embeds the clan, so leaving one without this leaves a ghost. */
function clanInvalidations(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: queryKeys.clan.all });
  void qc.invalidateQueries({ queryKey: queryKeys.me.dashboard });
}

export function useCreateClan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => clansApi.create(name),
    onSuccess: () => clanInvalidations(qc),
  });
}

export function useJoinClan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => clansApi.join(code),
    onSuccess: () => clanInvalidations(qc),
  });
}

export function useLeaveClan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clansApi.leave,
    onSuccess: () => {
      clanInvalidations(qc);
      // A disbanded clan cannot be in a war, and any proposal it made is gone.
      void qc.invalidateQueries({ queryKey: queryKeys.wars.all });
    },
  });
}

/** Leader only, full clan only. The assignment lands on the leader. */
export function useDrawClanTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (day: SeasonDay) => clansApi.drawTask(day),
    onSuccess: ({ assignment }) => {
      qc.setQueryData(queryKeys.assignment.current, { assignment });
    },
  });
}

/* --------------------------------------------------------------- voting */

/**
 * The open voting queue. Watchers only.
 *
 * Refetched on a 30s interval because windows close on a server clock and a
 * watcher voting on an expired item gets a 409 they could not have predicted.
 */
export function useOpenVotes() {
  return useQuery({
    queryKey: queryKeys.votes.open,
    queryFn: votingApi.open,
    select: (data) => data.items,
    retry: false,
    refetchInterval: 30_000,
  });
}

/** A vote pays coins, on a cooldown. Both the balance and the cooldown are
 *  on the outcome, so read them from there rather than refetching to find out. */
export function useVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, value }: { attemptId: string; value: VoteValue }) =>
      votingApi.vote(attemptId, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.votes.all });
      void qc.invalidateQueries({ queryKey: queryKeys.me.dashboard });
    },
  });
}

/* ----------------------------------------------------------------- shop */

export function useShopItems() {
  return useQuery({
    queryKey: queryKeys.shop.items,
    queryFn: shopApi.list,
    select: (data) => data.items,
    staleTime: 60_000,
  });
}

export function useMyPurchases() {
  return useQuery({
    queryKey: queryKeys.me.purchases,
    queryFn: shopApi.myPurchases,
    select: (data) => data.purchases,
    retry: false,
  });
}

/**
 * Buying moves coins and can empty the stock.
 *
 * Not optimistic, deliberately: a purchase that appears to succeed and then
 * fails on stock is worse than a half-second of spinner, because the player
 * has already decided they own the thing.
 */
export function useBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => shopApi.buy(itemId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.shop.all });
      void qc.invalidateQueries({ queryKey: queryKeys.me.purchases });
      void qc.invalidateQueries({ queryKey: queryKeys.me.dashboard });
    },
  });
}

/* ---------------------------------------------------------------- opals */

/** The price list and the card methods. Public. */
export function useOpals() {
  return useQuery({
    queryKey: queryKeys.opals.list,
    queryFn: opalsApi.list,
    staleTime: 60_000,
  });
}

export function useMyOpalOrders(enabled = true) {
  return useQuery({
    queryKey: queryKeys.opals.mine,
    queryFn: opalsApi.myOrders,
    select: (data) => data.orders,
    retry: false,
    enabled,
  });
}

/**
 * Buying opals moves the balance the whole game reads, so the dashboard is
 * invalidated with the order list. Not optimistic, for the same reason the
 * coin shop is not: money is involved, and a balance that jumps and then
 * falls back is worse than a moment of waiting.
 *
 * A `redirect` answer is the caller's to follow — the hook does not
 * navigate, so the screen can say where it is sending someone first.
 */
export function useBuyOpals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      packId,
      method,
    }: {
      packId: string;
      method: OpalPaymentMethod;
    }) => opalsApi.checkout(packId, method),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.opals.mine });
      void qc.invalidateQueries({ queryKey: queryKeys.me.dashboard });
    },
  });
}

/* ----------------------------------------------------------------- wars */

/**
 * The war list.
 *
 * Polls while anything could be moving. A war has a start time, a four-hour
 * run and a settlement, all on server clocks, so a page left open goes
 * stale in a way the reader cannot see.
 */
export function useWars(filter?: WarFilter) {
  return useQuery({
    queryKey: queryKeys.wars.list(filter),
    queryFn: () => warsApi.list(filter),
    select: (data) => data.wars,
    refetchInterval: 30_000,
  });
}

export function useWar(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.wars.one(id),
    queryFn: () => warsApi.get(id),
    select: (data) => data.war,
    enabled: enabled && Boolean(id),
    // Faster than the list: this is the page someone watches a war on, and
    // the pools move with every bet anyone places.
    refetchInterval: 15_000,
  });
}

function warInvalidations(qc: ReturnType<typeof useQueryClient>, id?: string) {
  void qc.invalidateQueries({ queryKey: queryKeys.wars.all });
  if (id) void qc.invalidateQueries({ queryKey: queryKeys.wars.one(id) });
}

export function useProposeWar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProposeWarInput) => warsApi.propose(input),
    onSuccess: () => warInvalidations(qc),
  });
}

export function useAcceptWar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warsApi.accept(id),
    onSuccess: (_result, id) => warInvalidations(qc, id),
  });
}

export function useDeclineWar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warsApi.decline(id),
    onSuccess: (_result, id) => warInvalidations(qc, id),
  });
}

/** Withdrawing refunds every stake, so balances move for other people too. */
export function useWithdrawWar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warsApi.withdraw(id),
    onSuccess: (_result, id) => {
      warInvalidations(qc, id);
      void qc.invalidateQueries({ queryKey: queryKeys.me.dashboard });
    },
  });
}

/** A bet spends coins immediately. Gate the control on `war.canBet.allowed`
 *  — a member of either clan is barred and the reason is worth showing. */
export function usePlaceBet(warId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaceBetInput) => warsApi.placeBet(warId, input),
    onSuccess: () => {
      warInvalidations(qc, warId);
      void qc.invalidateQueries({ queryKey: queryKeys.me.dashboard });
    },
  });
}

/* -------------------------------------------------------------- reports */

/** The report sheet's options. Reasons differ per target type — read them
 *  from here rather than hardcoding a list that will drift. */
export function useReportCatalogue() {
  return useQuery({
    queryKey: queryKeys.reports.catalogue,
    queryFn: reportsApi.reasons,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useMyReports(limit?: number) {
  return useQuery({
    queryKey: queryKeys.me.reports,
    queryFn: () => reportsApi.mine(limit),
    select: (data) => data.reports,
    retry: false,
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReportInput) => reportsApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.me.reports });
      // Enough reports auto-hide the thing, so the feed can change under us.
      void qc.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });
}

export function useWithdrawReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reportsApi.withdraw(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.me.reports });
    },
  });
}

/* --------------------------------------------------- the pool, for reading */

export function useTaskPool(tier?: 1 | 2 | 3) {
  return useQuery({
    queryKey: queryKeys.tasks.pool({ tier }),
    queryFn: () => gameApi.tasks({ tier }),
    select: (data) => data.tasks,
    staleTime: 120_000,
  });
}
