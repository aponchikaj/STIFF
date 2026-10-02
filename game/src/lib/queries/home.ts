"use client";

/**
 * Where a signed-in person belongs, and getting them there.
 *
 * The title screen, `/join` and `/login` are all questions — which side,
 * who are you — and someone with a session has already answered them.
 * Showing them the questions again is how a returning player ends up
 * looking at a sign-up form with a clock running somewhere else.
 */

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { getAccessToken, getStoredRefreshToken, type EnrolmentRole } from "@/lib/api";
import { useAuthState } from "./account";
import { useDashboard } from "./game";

/** A player's day is on `/play`; a watcher has no clock, the feed is theirs. */
export function homeFor(role: EnrolmentRole | null): string | null {
  if (role === "player") return "/play";
  if (role === "watcher") return "/feed";
  return null;
}

/**
 * The signed-in person's home, once it is known.
 *
 * The side comes from the enrolment, or — before a season exists to enrol
 * in — from the side they chose and the backend kept. `null` means signed
 * in without a side, which is a real state: a shop account that walked over
 * from stiff.ge.
 */
export function useHome() {
  const { isSignedIn, isResolved } = useAuthState();
  const dashboard = useDashboard({ enabled: isSignedIn });

  const role =
    dashboard.data?.enrolment?.role ?? dashboard.data?.rememberedRole ?? null;

  return {
    isSignedIn,
    href: homeFor(role),
    // `isPending`, not `isLoading`: on the render where the session first
    // resolves, the dashboard is enabled but has not started fetching yet,
    // and `isLoading` would call that "done, no side".
    isResolved: isResolved && (!isSignedIn || !dashboard.isPending),
  };
}

const noopSubscribe = () => () => {};

/** A token in storage — the cheap, synchronous hint that a session exists.
 *  False on the server and during hydration, so markup always matches. */
function useHasStoredSession(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => Boolean(getAccessToken() ?? getStoredRefreshToken()),
    () => false,
  );
}

/**
 * Send a signed-in visitor away from a screen that is only for strangers.
 *
 * `to` wins when given (a validated `?next=`). Otherwise home; and when they
 * have no side, `withoutSide` — or stay, if that is null, because the
 * screen is where a side gets picked.
 *
 * `pending` is true while a stored session is still being checked or the
 * redirect is under way. Render nothing then: a returning player should
 * never see the WATCHER / PLAYER question flash past on their way home.
 */
export function useSignedInRedirect({
  to = null,
  withoutSide = null,
}: { to?: string | null; withoutSide?: string | null } = {}) {
  const router = useRouter();
  const home = useHome();
  const hasStoredSession = useHasStoredSession();

  const target = home.isSignedIn ? (to ?? home.href ?? withoutSide) : null;
  const leaving = home.isResolved && Boolean(target);

  useEffect(() => {
    if (leaving && target) router.replace(target);
  }, [leaving, target, router]);

  return {
    pending: leaving || (!home.isResolved && hasStoredSession),
    isSignedIn: home.isSignedIn,
  };
}
