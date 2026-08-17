"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { staffPeopleApi, type StaffRole } from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import { useStaffSession } from "@/components/providers";
import {
  btnOutline,
  btnSolid,
  ErrorNote,
  Field,
  inputCls,
  Loading,
  selectCls,
} from "@/components/ui";

const ROLES: StaffRole[] = ["member", "admin", "owner"];

export function PeopleView() {
  const { user } = useStaffSession();
  const router = useRouter();
  const people = useAsync(() => staffPeopleApi.list(), []);
  const [error, setError] = useState<string | null>(null);
  const isOwner = user?.role === "owner";
  const canCreate = isOwner || user?.role === "admin";

  useEffect(() => {
    if (user && !canCreate) router.replace("/chat");
  }, [user, canCreate, router]);

  if (!canCreate) return <Loading label="People" />;
  if (people.loading) return <Loading label="People" />;
  if (people.error) return <ErrorNote message={people.error} />;

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    try {
      const created = await staffPeopleApi.create({
        username: String(data.get("username") ?? ""),
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
        instagramUsername: String(data.get("instagramUsername") ?? ""),
        role: (String(data.get("role") ?? "member") as StaffRole) || "member",
      });
      people.setData((prev) =>
        [...(prev ?? []), created].sort((a, b) =>
          a.username.localeCompare(b.username),
        ),
      );
      form.reset();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function changeRole(id: string, role: StaffRole) {
    setError(null);
    try {
      const updated = await staffPeopleApi.changeRole(id, role);
      people.setData((prev) =>
        (prev ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function setBlocked(id: string, blocked: boolean) {
    setError(null);
    try {
      const updated = await staffPeopleApi.setBlocked(id, blocked);
      people.setData((prev) =>
        (prev ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="flex flex-1 flex-col px-5 py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
        Directory
      </p>
      <h1 className="mt-1 text-3xl uppercase tracking-tight">People</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
        Staff accounts live in a separate table from the shop. Nobody can
        register themselves — create them here.
      </p>

      <form
        onSubmit={(e) => void create(e)}
        className="mt-10 grid gap-4 border border-subtle p-5 md:grid-cols-2"
      >
        <Field id="new-username" label="Username">
          <input id="new-username" name="username" required className={inputCls} />
        </Field>
        <Field id="new-email" label="Email">
          <input
            id="new-email"
            name="email"
            type="email"
            required
            className={inputCls}
          />
        </Field>
        <Field id="new-ig" label="Instagram">
          <input
            id="new-ig"
            name="instagramUsername"
            required
            placeholder="@handle"
            className={inputCls}
          />
        </Field>
        <Field id="new-password" label="Password">
          <input
            id="new-password"
            name="password"
            type="password"
            required
            minLength={8}
            className={inputCls}
          />
        </Field>
        <Field id="new-role" label="Role">
          <select
            id="new-role"
            name="role"
            defaultValue="member"
            className={selectCls}
          >
            <option value="member">Member</option>
            {isOwner && <option value="admin">Admin</option>}
            {isOwner && <option value="owner">Owner</option>}
          </select>
        </Field>
        <div className="flex items-end">
          <button type="submit" className={btnSolid}>
            Create account
          </button>
        </div>
      </form>
      {error && <p className="mt-3 text-xs text-muted">{error}</p>}

      <ul className="mt-10 divide-y divide-subtle border-y border-subtle">
        {(people.data ?? []).map((person) => (
          <li
            key={person.id}
            className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.12em]">
                {person.username}
                {person.isBlocked && (
                  <span className="ml-2 text-[10px] text-muted">Blocked</span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted">
                {person.email} · @{person.instagramUsername}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isOwner ? (
                <select
                  className={selectCls}
                  value={person.role}
                  onChange={(e) =>
                    void changeRole(person.id, e.target.value as StaffRole)
                  }
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[11px] uppercase tracking-[0.15em] text-muted">
                  {person.role}
                </span>
              )}
              {person.id !== user?.id && (
                <button
                  type="button"
                  className={btnOutline}
                  onClick={() => void setBlocked(person.id, !person.isBlocked)}
                >
                  {person.isBlocked ? "Unblock" : "Block"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
