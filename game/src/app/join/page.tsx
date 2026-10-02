"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Haze } from "@/components/crt";
import { ChoiceGroup, Field } from "@/components/form";
import { Icon } from "@/components/icon";
import { BackLink } from "@/components/nav";
import {
  Body,
  Button,
  Display,
  ErrorNote,
  Label,
  Loading,
  Rule,
  Screen,
} from "@/components/ui";
import { errorMessages, type EnrolmentRole } from "@/lib/api";
import {
  useAuthState,
  useEnrol,
  useGameRegister,
  useRules,
  homeFor,
  useSignedInRedirect,
} from "@/lib/queries";

/**
 * The front door: pick a side, then make an account.
 *
 * One question per screen, deliberately. The backend takes all of it in a
 * single `POST /game/register` — a side, a handle, a password and a date of
 * birth — but asking for four things at once from someone who arrived
 * thirty seconds ago is how you lose them. So the side comes first (it is
 * the interesting question, and it is reversible), and the form second.
 *
 * Two paths converge here and they are not the same request:
 *
 *   signed out → `POST /game/register`   creates a shop account + enrolment
 *   signed in  → `POST /game/enrolments` enrols the account that exists
 *
 * The signed-in path still has to ask for a date of birth the first time,
 * because a shop account made on stiff.ge was never asked its age and the
 * game is 16+ strictly.
 */

type Step = "side" | "details";

export default function JoinPage() {
  return (
    <Suspense fallback={<Loading />}>
      <JoinFlow />
    </Suspense>
  );
}

/** `?side=` from the title screen, which has already asked the question. */
function sideFromParam(raw: string | null): EnrolmentRole | null {
  return raw === "player" || raw === "watcher" ? raw : null;
}

function JoinFlow() {
  const router = useRouter();
  const rules = useRules();
  const { isSignedIn } = useAuthState();
  const preset = sideFromParam(useSearchParams().get("side"));

  // Someone who already has a side has nothing to do here. Signed in
  // *without* one stays: this is where a stiff.ge account picks a side.
  const { pending: leaving } = useSignedInRedirect();

  // Arriving with a side means the title screen already asked, by the
  // button that was pressed. That visitor *is* a player or a watcher now, so
  // the picker is not shown at all and there is no way back to it from here
  // — only back to the title, where the other button is.
  const [step, setStep] = useState<Step>(preset ? "details" : "side");
  const [role, setRole] = useState<EnrolmentRole | null>(preset);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");

  const register = useGameRegister();
  const enrol = useEnrol();
  const pending = register.isPending || enrol.isPending;
  const errors = errorMessages(register.error ?? enrol.error);

  const minimumAge = rules.data?.minimumAge ?? 16;

  async function submit() {
    if (!role) return;

    // The mutations hold their own error and the form renders it, so a
    // failure here only needs to stop the redirect — not escape as an
    // unhandled rejection.
    try {
      if (isSignedIn) {
        await enrol.mutateAsync({ role, birthDate: birthDate || undefined });
      } else {
        await register.mutateAsync({
          username: username.trim(),
          password,
          role,
          birthDate,
          email: email.trim() || undefined,
        });
      }
    } catch {
      return;
    }

    // A watcher has no clock and no task, so sending them to /play would be
    // an empty screen. The feed is the whole point of being a watcher.
    router.push(homeFor(role) ?? "/");
  }

  if (leaving) return <Loading />;

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Haze intensity="md" />

      <Screen width="sm" className="flex min-h-dvh flex-col justify-center py-16">
        <div className="mb-2">
          {step === "side" || preset ? (
            <BackLink href="/">Title</BackLink>
          ) : (
            <button
              type="button"
              onClick={() => setStep("side")}
              className="group inline-flex items-center gap-2 py-3 font-pixel text-[9px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-cyan"
            >
              <Icon name="arrow-left" size="xs" className="opacity-60" />
              Side
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {step === "side" ? (
            <motion.div
              key="side"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-10"
            >
              <header className="flex flex-col gap-3">
                <Label>Step 1 of 2</Label>
                <Display size="title">Pick a side</Display>
                <Body size="sm">
                  You can only be one this season. Players hand things in;
                  watchers judge them and get paid for it.
                </Body>
              </header>

              <ChoiceGroup<EnrolmentRole>
                name="role"
                value={role}
                onChange={setRole}
                options={[
                  {
                    value: "player",
                    label: "Player",
                    description:
                      "Three days, a task a day, a clock on each one. You start with " +
                      `${rules.data?.startingHearts ?? 3} hearts and lose one every time you say no.`,
                    icon: <Icon name="run" size="md" />,
                  },
                  {
                    value: "watcher",
                    label: "Watcher",
                    description:
                      "You vote on what gets handed in and earn coins for it. No clock, no hearts, nothing to lose.",
                    icon: <Icon name="eye" size="md" />,
                  },
                ]}
              />

              <div className="flex flex-col gap-5">
                <Rule />
                <div className="flex items-center justify-between">
                  <Label tone="faint">{minimumAge}+ only</Label>
                  <Button
                    size="lg"
                    disabled={!role}
                    onClick={() => setStep("details")}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="details"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-9"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <header className="flex flex-col gap-3">
                {preset ? (
                  <Label tone={preset === "player" ? "heart" : "blue"}>
                    Joining as {preset}
                  </Label>
                ) : (
                  <Label>Step 2 of 2</Label>
                )}
                <Display size="title">
                  {isSignedIn ? "Confirm" : "Make a name"}
                </Display>
                <Body size="sm">
                  {isSignedIn
                    ? `You are joining as a ${role}. We need your date of birth once — the game is ${minimumAge}+.`
                    : "No email needed. Add one later if you want order mail and password resets."}
                </Body>
              </header>

              {!isSignedIn ? (
                <>
                  <Field
                    label="Handle"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    required
                    minLength={3}
                    maxLength={24}
                    pattern="[a-zA-Z0-9_]+"
                    placeholder="LETTERS, NUMBERS, _"
                    hint="This is the name on the board and under every hand-in."
                  />

                  <Field
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                    hint="Eight characters or more."
                  />
                </>
              ) : null}

              <Field
                label="Date of birth"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                required
                autoComplete="bday"
                hint={`Checked before anything is created. Under ${minimumAge} and nothing is.`}
              />

              {!isSignedIn ? (
                <Field
                  label="Email — optional"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="SKIP IT"
                  hint="Only needed to reset a password or get order mail."
                />
              ) : null}

              {errors.length ? (
                <div className="flex flex-col gap-1">
                  {errors.map((message) => (
                    <ErrorNote key={message}>{message}</ErrorNote>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-col gap-5">
                <Rule />
                <div className="flex items-center justify-between gap-4">
                  {!isSignedIn ? (
                    <Link
                      href="/login"
                      className="font-body text-[11px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-cyan"
                    >
                      Have an account?
                    </Link>
                  ) : (
                    <span />
                  )}

                  <Button type="submit" size="lg" loading={pending}>
                    {isSignedIn ? "Join" : "Start"}
                  </Button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </Screen>
    </main>
  );
}
