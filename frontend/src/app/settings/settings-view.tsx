"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authApi, profileApi } from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import { Reveal } from "@/components/motion";
import { useSession } from "@/components/providers";
import {
  btnGhostSm,
  btnOutline,
  btnSolidSm,
  chipCls,
  Field,
  inputCls,
  labelCls,
  Loading,
} from "@/components/ui";

export function SettingsView() {
  const { user, loading, setUser, refreshUser } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/settings");
  }, [loading, user, router]);

  if (loading || !user) return <Loading label="Loading settings" />;

  return (
    <div className="flex flex-col gap-14">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
          Settings
        </h1>
        <Link href="/account" className={btnOutline}>
          ← My account
        </Link>
      </Reveal>

      <Appearance />
      <Notifications />

      <section aria-label="Account settings">
        <h2 className="text-2xl uppercase tracking-tight sm:text-4xl">
          Account
        </h2>
        <div className="mt-6 grid gap-10 sm:grid-cols-2">
          <UsernameForm
            onUpdated={(username) => setUser({ ...user, username })}
          />
          <PasswordForm onChanged={refreshUser} />
        </div>
      </section>

      <DangerZone
        onDeleted={() => {
          setUser(null);
          router.push("/");
        }}
      />
    </div>
  );
}

function Appearance() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
  }, []);

  async function apply(next: "light" | "dark") {
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // private mode — still applies for this visit
    }
    try {
      await profileApi.updateSettings({ theme: next });
      setNote("Saved.");
    } catch (err) {
      setNote(errorMessage(err));
    }
  }

  return (
    <section aria-label="Appearance">
      <h2 className="text-2xl uppercase tracking-tight sm:text-4xl">
        Appearance
      </h2>
      <p className="mt-2 text-sm text-muted">
        The site opens in light mode by default.
      </p>
      <div className="mt-4 flex gap-1.5">
        {(["light", "dark"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={theme === t}
            onClick={() => apply(t)}
            className={chipCls(theme === t)}
          >
            {t}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted">
        {note}
      </p>
    </section>
  );
}

function Notifications() {
  const { data, loading } = useAsync(() => profileApi.getSettings(), []);
  const [emailOn, setEmailOn] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (data) setEmailOn(Boolean(data.emailNotifications));
  }, [data]);

  if (loading || emailOn === null) {
    return (
      <section aria-label="Notifications">
        <h2 className="text-2xl uppercase tracking-tight sm:text-4xl">
          Notifications
        </h2>
        <Loading label="Loading preferences" />
      </section>
    );
  }

  return (
    <section aria-label="Notifications">
      <h2 className="text-2xl uppercase tracking-tight sm:text-4xl">
        Notifications
      </h2>
      <label className="mt-4 flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={emailOn}
          onChange={async (e) => {
            const next = e.target.checked;
            setEmailOn(next);
            setNote(null);
            try {
              await profileApi.updateSettings({ emailNotifications: next });
              setNote("Saved.");
            } catch (err) {
              setNote(errorMessage(err));
            }
          }}
          className="size-4 accent-foreground"
        />
        <span className="text-sm">
          Email me about account activity (verification, password resets)
        </span>
      </label>
      <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted">
        {note}
      </p>
    </section>
  );
}

function UsernameForm({ onUpdated }: { onUpdated: (u: string) => void }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const username = String(
          new FormData(e.currentTarget).get("username") ?? "",
        );
        setNote(null);
        try {
          const updated = await profileApi.updateProfile({ username });
          onUpdated(updated.username);
          setNote("Username updated.");
        } catch (err) {
          setNote(errorMessage(err));
        }
      }}
    >
      <p className={labelCls}>Change username</p>
      <Field id="set-username" label="New username">
        <input
          id="set-username"
          name="username"
          required
          minLength={3}
          maxLength={24}
          pattern="[a-zA-Z0-9_]+"
          className={inputCls}
        />
      </Field>
      <button type="submit" className={`${btnSolidSm} self-start`}>
        Save
      </button>
      <p aria-live="polite" className="min-h-4 text-xs text-muted">
        {note}
      </p>
    </form>
  );
}

function PasswordForm({ onChanged }: { onChanged: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setNote(null);
        try {
          await profileApi.changePassword({
            currentPassword: String(data.get("current") ?? ""),
            newPassword: String(data.get("next") ?? ""),
          });
          form.reset();
          setNote("Password changed. Other sessions were logged out.");
          onChanged();
        } catch (err) {
          setNote(errorMessage(err));
        }
      }}
    >
      <p className={labelCls}>Change password</p>
      <Field id="set-current" label="Current password">
        <input
          id="set-current"
          name="current"
          type="password"
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </Field>
      <Field id="set-next" label="New password">
        <input
          id="set-next"
          name="next"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputCls}
        />
      </Field>
      <button type="submit" className={`${btnSolidSm} self-start`}>
        Change
      </button>
      <p aria-live="polite" className="min-h-4 text-xs text-muted">
        {note}
      </p>
    </form>
  );
}

function DangerZone({ onDeleted }: { onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <section
      aria-label="Delete account"
      className="border-t border-subtle pt-8"
    >
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={btnGhostSm}
        >
          Delete my account
        </button>
      ) : (
        <form
          className="flex max-w-sm flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const password = String(
              new FormData(e.currentTarget).get("password") ?? "",
            );
            setNote(null);
            try {
              await authApi.deleteAccount(password);
              onDeleted();
            } catch (err) {
              setNote(errorMessage(err));
            }
          }}
        >
          <p className="text-xs leading-6 text-muted">
            This permanently deletes your account, cart, comments and
            notifications. Order history is kept anonymously. Enter your
            password to confirm.
          </p>
          <Field id="del-password" label="Password">
            <input
              id="del-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={inputCls}
            />
          </Field>
          <div className="flex gap-3">
            <button type="submit" className={btnSolidSm}>
              Delete forever
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={btnGhostSm}
            >
              Cancel
            </button>
          </div>
          <p aria-live="polite" className="min-h-4 text-xs text-muted">
            {note}
          </p>
        </form>
      )}
    </section>
  );
}
