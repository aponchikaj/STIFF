"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Haze } from "@/components/crt";
import { Icon } from "@/components/icon";
import { Account } from "@/components/me/account";
import { HandIns, Inbox, Shortcuts } from "@/components/me/activity";
import { IdentityCard, SeasonCard } from "@/components/me/header";
import { ErrorNote, Loading, Screen } from "@/components/ui";
import { useAuthState, useDashboard, useStanding } from "@/lib/queries";

/**
 * `/me` — you, your season, and your account.
 *
 * Read top to bottom in the order the questions come:
 *
 *   who am I here          the identity card — handle, side, account
 *   how is my season       nerve, opals, rank, hearts, today — and the
 *                          one thing to do next (play, or vote)
 *   where do I go          four shortcuts
 *   what happened          the inbox
 *   what did I hand in     every upload, and where it is now
 *   the account            sign-in name, email, password, sign out
 *
 * The account (permanent, shared with the shop) and the enrolment (this
 * season's, demotable) stay visibly separate — a cheating verdict must not
 * read as though it deleted someone's account.
 */
export default function MePage() {
  const { isSignedIn, isResolved } = useAuthState();
  const dashboard = useDashboard();
  const standing = useStanding();

  if (!isResolved || (isSignedIn && dashboard.isLoading)) {
    return (
      <Screen width="md" className="flex min-h-[60dvh] items-center justify-center">
        <Loading label="LOADING YOU" />
      </Screen>
    );
  }

  if (!isSignedIn) return <SignedOut />;

  const data = dashboard.data;
  if (!data) {
    return (
      <Screen width="md" className="py-10">
        <ErrorNote>Your profile could not be loaded. Try again in a moment.</ErrorNote>
      </Screen>
    );
  }

  const enrolment = data.enrolment;
  const playing = enrolment?.role === "player" && enrolment.status === "active";

  return (
    <main className="relative overflow-hidden">
      <Haze intensity="md" />

      <Screen width="md" className="flex flex-col gap-5 pb-10 pt-2 sm:gap-6">
        <IdentityCard data={data} />
        <SeasonCard data={data} standing={standing.data} />
        <Shortcuts handle={enrolment?.handle ?? null} coins={enrolment?.coins ?? null} />
        <Inbox />
        <HandIns playing={playing} />
        <Account user={data.user} handle={enrolment?.handle ?? null} />
      </Screen>
    </main>
  );
}

/** Signed out: what an account holds, and the two ways in. */
function SignedOut() {
  return (
    <main className="relative overflow-hidden">
      <Haze intensity="lg" />
      <Screen width="sm" className="flex min-h-[72dvh] flex-col items-center justify-center gap-8 text-center">
        <motion.span
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 16 }}
          className="bloom-cyan-lg block"
        >
          <span className="flex size-24 items-center justify-center bg-blue-deep frame-notch-lg scanlines">
            <Icon name="profile" size="xl" />
          </span>
        </motion.span>

        <div className="flex flex-col gap-3">
          <p className="font-pixel text-[15px] uppercase tracking-[0.1em] text-ink text-glow">
            You are not signed in
          </p>
          <p className="mx-auto max-w-xs font-body text-body-sm leading-[20px] text-ink-muted">
            Your opals, your hearts, your hand-ins and your place on the board
            all live on an account.
          </p>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <Link
            href="/login?next=/me"
            className="block bg-blue py-3.5 font-pixel text-[12px] uppercase tracking-[0.12em] text-void frame-notch hover:bg-cyan"
          >
            Sign in
          </Link>
          <Link
            href="/join"
            className="block bg-surface-3 py-3.5 font-pixel text-[12px] uppercase tracking-[0.12em] text-ink frame-notch hover:bg-surface-2 hover:text-cyan"
          >
            Make an account
          </Link>
        </div>
      </Screen>
    </main>
  );
}
