"use client";

/**
 * Hooks for the player's own loop: season, dashboard, assignment, hand-in.
 *
 * Two things here are not ordinary CRUD and are worth reading before using:
 *
 * 1. **The assignment is a clock.** `useCurrentAssignment` refetches on a
 *    short interval while a clock is running and not at all when it is not,
 *    because the only thing that changes server-side is time. The countdown
 *    itself is `useCountdown`, local, so the number ticks at 60fps without
 *    60 requests a second.
 *
 * 2. **A hand-in is three steps, not one.** `useHandIn` runs them in order
 *    — ticket, upload, confirm — and only invalidates on the confirm,
 *    because an attempt that uploaded but failed to confirm does not exist
 *    yet and must not appear anywhere.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  ApiError,
  gameApi,
  uploadToSignedUrl,
  type AttemptKind,
  type ConfirmAttemptInput,
  type Dashboard,
  type DeclineOutcome,
  type GameRegisterInput,
  type GameRules,
  type PlayableTasksQuery,
  type SeasonDay,
} from "@/lib/api";
import { queryKeys } from "./keys";

/* ---------------------------------------------------------------- static */

/**
 * The rules. Hearts, the daily minimum, the voting window, the age gate.
 *
 * `staleTime: Infinity` because these come from server constants that only
 * change on a deploy — and a screen that re-reads them every minute will
 * eventually render "3 hearts" next to a board that says 5.
 */
export function useRules(options?: Partial<UseQueryOptions<GameRules>>) {
  return useQuery({
    queryKey: queryKeys.rules,
    queryFn: gameApi.rules,
    staleTime: Infinity,
    gcTime: Infinity,
    ...options,
  });
}

export function useSeason() {
  return useQuery({
    queryKey: queryKeys.season,
    queryFn: gameApi.season,
    staleTime: 60_000,
    select: (data) => data.season,
  });
}

/** Liveness. Polls slowly; used by the boot screen to tell "API down" from
 *  "you are signed out", which are the same 401-shaped silence otherwise. */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: gameApi.health,
    refetchInterval: 30_000,
    retry: false,
  });
}

/* ------------------------------------------------------------- the player */

/**
 * Everything the dashboard renders. The backend bundles it into one call
 * deliberately — do not decompose this into the four queries it contains.
 */
export function useDashboard(options?: Partial<UseQueryOptions<Dashboard>>) {
  return useQuery({
    queryKey: queryKeys.me.dashboard,
    queryFn: gameApi.dashboard,
    staleTime: 15_000,
    // A signed-out visitor gets a 401 here and that is a fact, not a fault.
    // Retrying it three times just delays the sign-in screen.
    retry: (count, error) =>
      error instanceof ApiError && error.isUnauthorized ? false : count < 2,
    ...options,
  });
}

export function useMyEnrolment() {
  return useQuery({
    queryKey: queryKeys.me.enrolment,
    queryFn: gameApi.myEnrolment,
    select: (data) => data.enrolment,
    retry: false,
  });
}

/** The game's own sign-up. Seeds every cache the dashboard would have to
 *  fetch, so the screen after registration paints with no spinner. */
export function useGameRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GameRegisterInput) => gameApi.register(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.me.all });
    },
  });
}

/** Take a side with an account that already exists. */
export function useEnrol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: gameApi.enrol,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.me.all });
      void qc.invalidateQueries({ queryKey: queryKeys.leaderboard.all });
    },
  });
}

/* ---------------------------------------------------------------- tasks */

export function usePool(query: PlayableTasksQuery = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.pool(query),
    queryFn: () => gameApi.tasks(query),
    select: (data) => data.tasks,
    staleTime: 120_000,
  });
}

/**
 * The offer waiting or the clock running.
 *
 * Polls every 15s while something is live and stops entirely when nothing
 * is — a watcher, or a player who has handed in. The poll is a safety net
 * for a clock that expired server-side while the tab was asleep; the
 * visible countdown is local.
 */
export function useCurrentAssignment() {
  return useQuery({
    queryKey: queryKeys.assignment.current,
    queryFn: gameApi.currentAssignment,
    select: (data) => data.assignment,
    retry: false,
    refetchInterval: (query) => {
      const assignment = query.state.data?.assignment;
      if (!assignment) return false;
      return assignment.status === "accepted" || assignment.status === "offered"
        ? 15_000
        : false;
    },
  });
}

export function useDrawTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (day: SeasonDay) => gameApi.drawTask(day),
    onSuccess: ({ assignment }) => {
      // The response *is* the current assignment, so seed rather than
      // invalidate: a draw is the one moment a player is watching the screen.
      qc.setQueryData(queryKeys.assignment.current, { assignment });
    },
  });
}

/** Leader-only team draw lives in `useClans`; this is the solo path. */
export function useAcceptAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gameApi.acceptAssignment(id),
    onSuccess: ({ assignment }) => {
      qc.setQueryData(queryKeys.assignment.current, { assignment });
      void qc.invalidateQueries({ queryKey: queryKeys.me.dashboard });
    },
  });
}

/**
 * Declining costs a heart, and the last heart ends their season as a player.
 *
 * `demoted` on the result is the only reliable signal for that — the
 * dashboard will agree a moment later, but the confirmation screen has to
 * decide what to say *now*.
 */
export function useDeclineAssignment() {
  const qc = useQueryClient();
  return useMutation<DeclineOutcome, ApiError, string>({
    mutationFn: (id) => gameApi.declineAssignment(id),
    onSuccess: (outcome) => {
      qc.setQueryData(queryKeys.assignment.current, {
        assignment: outcome.assignment,
      });
      void qc.invalidateQueries({ queryKey: queryKeys.me.all });
      if (outcome.demoted) {
        void qc.invalidateQueries({ queryKey: queryKeys.leaderboard.all });
      }
    },
  });
}

/* ------------------------------------------------------------- hand-ins */

export function useMyAttempts() {
  return useQuery({
    queryKey: queryKeys.me.attempts,
    queryFn: gameApi.myAttempts,
    select: (data) => data.attempts,
    retry: false,
  });
}

export type HandInStage = "idle" | "preparing" | "uploading" | "confirming" | "done";

export interface HandInInput {
  assignmentId: string;
  file: File;
  kind: AttemptKind;
  /** Whole seconds. Required for a clip — read it off the video element. */
  durationSeconds?: number;
  width?: number;
  height?: number;
  caption?: string;
}

/**
 * The whole hand-in, as one call with observable progress.
 *
 * Why a hand-in is not a single mutation: the bytes go straight to object
 * storage on a signed URL, so there are three round trips and only the
 * middle one is slow. A player on a phone with a clock at 00:40 needs to
 * see which of the three is happening and how far the upload has got — a
 * single opaque pending state is the difference between waiting and
 * force-quitting the tab.
 *
 * Nothing is invalidated until the confirm lands. An uploaded-but-
 * unconfirmed attempt is `awaiting_upload` server-side and must not show up
 * in the player's own list as though it counted.
 */
export function useHandIn() {
  const qc = useQueryClient();
  const [stage, setStage] = useState<HandInStage>("idle");
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (input: HandInInput) => {
      setStage("preparing");
      setProgress(0);

      const ticket = await gameApi.requestUpload({
        assignmentId: input.assignmentId,
        kind: input.kind,
        mimeType: input.file.type,
        byteSize: input.file.size,
        durationSeconds: input.durationSeconds,
      });

      setStage("uploading");
      await uploadToSignedUrl(
        ticket.uploadUrl,
        input.file,
        // The signed content type, not the file's — they are the same in
        // practice, but the signature is over the former and storage will
        // reject a mismatch with an error that looks like a network fault.
        ticket.contentType,
        setProgress,
      );

      setStage("confirming");
      const confirmation: ConfirmAttemptInput = {
        byteSize: input.file.size,
        durationSeconds: input.durationSeconds,
        width: input.width,
        height: input.height,
        caption: input.caption,
      };
      const result = await gameApi.confirmAttempt(ticket.attemptId, confirmation);

      setStage("done");
      return result;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.me.all });
      void qc.invalidateQueries({ queryKey: queryKeys.assignment.all });
      void qc.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
    onError: () => setStage("idle"),
  });

  const reset = useCallback(() => {
    setStage("idle");
    setProgress(0);
    mutation.reset();
  }, [mutation]);

  return { ...mutation, stage, progress, reset };
}
