"use client";

/**
 * The bottom of /me: the account behind the player.
 *
 * Each setting is a row that shows what it is now, and opens into its own
 * small form — nobody edits three things at once, and a password field
 * sitting open on a profile is a field someone types into by accident.
 * The rules are the server's (`users.dto.ts`), checked here first so the
 * answer comes before the round trip, and the server's word wins after.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Field } from "@/components/form";
import { Icon } from "@/components/icon";
import { Button, Dialog, ErrorNote } from "@/components/ui";
import type { ApiError, SafeUser } from "@/lib/api";
import {
  useChangePassword,
  useLogout,
  useUpdateProfile,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Card } from "./header";

const USERNAME = /^[a-zA-Z0-9_]{3,24}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Open = "username" | "email" | "password" | null;

export function Account({ user, handle }: { user: SafeUser; handle: string | null }) {
  const [open, setOpen] = useState<Open>(null);
  const toggle = (row: Exclude<Open, null>) => setOpen((o) => (o === row ? null : row));

  return (
    <Card tone="quiet" delay={0.36}>
      <div className="flex flex-col">
        <div className="flex items-center gap-2.5 px-5 pb-2 pt-5 sm:px-6">
          <Icon name="settings" size="sm" />
          <span className="font-pixel text-[11px] uppercase tracking-[0.1em] text-ink">Account</span>
        </div>

        <Row
          label="Sign-in name"
          value={user.username}
          open={open === "username"}
          onToggle={() => toggle("username")}
        >
          <UsernameForm current={user.username} handle={handle} onDone={() => setOpen(null)} />
        </Row>

        <Row
          label="Email"
          value={user.email ?? "None yet"}
          valueTone={user.email ? undefined : "caution"}
          open={open === "email"}
          onToggle={() => toggle("email")}
        >
          <EmailForm current={user.email} onDone={() => setOpen(null)} />
        </Row>

        <Row
          label="Password"
          value="••••••••"
          open={open === "password"}
          onToggle={() => toggle("password")}
        >
          <PasswordForm onDone={() => setOpen(null)} />
        </Row>

        {/* No email-notifications switch: the setting is stored server-side
            but nothing sends mail by it yet, and a switch that does nothing
            is a promise the game would break. Add it with the sending. */}

        <SignOut />
      </div>
    </Card>
  );
}

/* ================================================================= rows */

function Row({
  label,
  value,
  valueTone,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  valueTone?: "caution";
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-blue-dim/30">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-3/60 sm:px-6"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-body text-[10px] uppercase tracking-[0.14em] text-ink-faint">{label}</span>
          <span
            className={cn(
              "truncate font-body text-[15px]",
              valueTone === "caution" ? "text-caution" : "text-ink",
            )}
          >
            {value}
          </span>
        </span>
        <span className="font-pixel text-[9px] uppercase tracking-[0.12em] text-blue">
          {open ? "Close" : "Change"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6 pt-1 sm:px-6">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** A plain-text field: the shared Field is pixel-uppercase, wrong for an address. */
const PLAIN = "font-body text-[15px] normal-case tracking-normal";

/* ================================================================ forms */

function UsernameForm({
  current,
  handle,
  onDone,
}: {
  current: string;
  handle: string | null;
  onDone: () => void;
}) {
  const update = useUpdateProfile();
  const [value, setValue] = useState(current);
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const local =
    !USERNAME.test(trimmed)
      ? "3 to 24 letters, numbers or underscores."
      : trimmed === current
        ? "That is your name already."
        : null;
  const error = (update.error as ApiError | null)?.message ?? (touched ? local : null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (local) return;
    update.mutate({ username: trimmed }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field
        label="New sign-in name"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          update.reset();
        }}
        onBlur={() => setTouched(true)}
        autoComplete="username"
        maxLength={24}
        className={PLAIN}
        error={error ?? undefined}
        hint={
          handle
            ? `What you sign in with. Your game handle stays @${handle} this season.`
            : "What you sign in with, on the game and the shop."
        }
      />
      <FormActions busy={update.isPending} onCancel={onDone} label="Save name" />
    </form>
  );
}

function EmailForm({ current, onDone }: { current: string | null; onDone: () => void }) {
  const update = useUpdateProfile();
  const [value, setValue] = useState(current ?? "");
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const local = !EMAIL.test(trimmed)
    ? "That does not look like an email address."
    : trimmed.toLowerCase() === (current ?? "").toLowerCase()
      ? "That is your address already."
      : null;
  const error = (update.error as ApiError | null)?.message ?? (touched ? local : null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (local) return;
    update.mutate({ email: trimmed }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field
        label={current ? "New email" : "Email"}
        type="email"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          update.reset();
        }}
        onBlur={() => setTouched(true)}
        autoComplete="email"
        inputMode="email"
        className={PLAIN}
        error={error ?? undefined}
        hint="It needs verifying again once changed — it is how you get back in if you forget your password."
      />
      <FormActions busy={update.isPending} onCancel={onDone} label="Save email" />
    </form>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const change = useChangePassword();
  const [currentPassword, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);

  const local = !currentPassword
    ? "Enter your current password."
    : next.length < 8
      ? "At least 8 characters."
      : next.length > 72
        ? "At most 72 characters."
        : next !== again
          ? "The two new passwords do not match."
          : null;
  const serverError = (change.error as ApiError | null)?.message ?? null;

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (local) return;
    change.mutate(
      { currentPassword, newPassword: next },
      {
        onSuccess: () => {
          setSaved(true);
          setCurrent("");
          setNext("");
          setAgain("");
          setTouched(false);
          window.setTimeout(onDone, 1400);
        },
      },
    );
  }

  if (saved) {
    return (
      <p role="status" className="flex items-center gap-2 font-body text-body-sm text-good">
        <Icon name="star" size="xs" /> Password changed.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field
        label="Current password"
        type="password"
        value={currentPassword}
        onChange={(e) => {
          setCurrent(e.target.value);
          change.reset();
        }}
        autoComplete="current-password"
        className={PLAIN}
      />
      <Field
        label="New password"
        type="password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        maxLength={72}
        className={PLAIN}
        hint="At least 8 characters."
      />
      <Field
        label="New password, again"
        type="password"
        value={again}
        onChange={(e) => setAgain(e.target.value)}
        autoComplete="new-password"
        maxLength={72}
        className={PLAIN}
      />
      {touched && local ? <ErrorNote>{local}</ErrorNote> : null}
      {serverError ? <ErrorNote>{serverError}</ErrorNote> : null}
      <FormActions busy={change.isPending} onCancel={onDone} label="Change password" />
    </form>
  );
}

function FormActions({
  busy,
  onCancel,
  label,
}: {
  busy: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-end gap-6">
      <Button type="button" variant="quiet" size="sm" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button type="submit" size="sm" loading={busy}>
        {label}
      </Button>
    </div>
  );
}

/* ============================================================== sign out */

function SignOut() {
  const router = useRouter();
  const logout = useLogout();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="border-t border-blue-dim/30 px-5 py-4 sm:px-6">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-pixel text-[10px] uppercase tracking-[0.12em] text-heart transition-[text-shadow] hover:[text-shadow:var(--glow-heart)]"
      >
        Sign out
      </button>
      <Dialog
        open={confirming}
        title="Sign out?"
        confirmLabel="Sign out"
        cancelLabel="Stay"
        busy={logout.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          logout.mutate(undefined, {
            onSettled: () => {
              setConfirming(false);
              router.push("/");
            },
          })
        }
      >
        A task clock you have running keeps running while you are signed out.
      </Dialog>
    </div>
  );
}
