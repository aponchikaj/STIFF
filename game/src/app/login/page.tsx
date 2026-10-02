"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Haze } from "@/components/crt";
import { Field } from "@/components/form";
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
import { errorMessages } from "@/lib/api";
import { useLogin, useSignedInRedirect } from "@/lib/queries";

/**
 * Sign in — to the shop's session, which is the only session there is.
 *
 * Someone who made an account on stiff.ge signs in here with the same
 * credentials and arrives already enrolled or ready to enrol. The field
 * accepts either a username or an email because the backend's `LoginDto`
 * does, and guessing which one a visitor will type is a losing game.
 */
function LoginForm() {
  const params = useSearchParams();
  const login = useLogin();

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");

  // Where to go afterwards. Only ever an in-app path: an open redirect on a
  // sign-in page is the classic phishing hand-off, so anything that is not
  // a bare `/path` is discarded rather than sanitised.
  const raw = params.get("next");
  const next = raw && /^\/[^/\\]/.test(raw) ? raw : null;

  // Signed in already, or the moment this form succeeds: go to `next`, or
  // home for their side, or the title screen to pick one. One path for both
  // cases, so a fresh sign-in and a returning visitor land the same place.
  const { pending } = useSignedInRedirect({ to: next, withoutSide: "/" });

  const errors = errorMessages(login.error);

  if (pending) return <Loading />;

  return (
    <form
      className="flex flex-col gap-9"
      onSubmit={(event) => {
        event.preventDefault();
        login.mutate({ emailOrUsername: emailOrUsername.trim(), password });
      }}
    >
      <header className="flex flex-col gap-3">
        <Label>Continue</Label>
        <Display size="title">Sign in</Display>
        <Body size="sm">
          The same account as the shop. One sign-in covers both.
        </Body>
      </header>

      <Field
        label="Handle or email"
        value={emailOrUsername}
        onChange={(event) => setEmailOrUsername(event.target.value)}
        autoComplete="username"
        required
        autoFocus
      />

      <Field
        label="Password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        required
      />

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
          <Link
            href="/join"
            className="font-body text-[11px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-cyan"
          >
            No account?
          </Link>
          <Button type="submit" size="lg" loading={login.isPending}>
            Enter
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Haze intensity="md" />
      <Screen width="sm" className="flex min-h-dvh flex-col justify-center py-16">
        <div className="mb-2">
          <BackLink href="/">Title</BackLink>
        </div>
        {/* useSearchParams needs a boundary or the whole route opts out of
            static rendering. */}
        <Suspense fallback={<Loading />}>
          <LoginForm />
        </Suspense>
      </Screen>
    </main>
  );
}
