"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  hasPerm,
  staffPeopleApi,
  staffRolesApi,
  type StaffRole,
} from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import { useStaffSession } from "@/components/providers";
import {
  Avatar,
  Banner,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  PageHeader,
  SearchInput,
  btnOutline,
  btnSolid,
  inputCls,
  pagePad,
  selectCls,
} from "@/components/ui";

function assignableRoles(
  roles: StaffRole[],
  canCreateOwner: boolean,
): StaffRole[] {
  return roles.filter((role) => !role.isOwner || canCreateOwner);
}

function roleOptions(
  roles: StaffRole[],
  canCreateOwner: boolean,
  currentRoleId?: string,
): StaffRole[] {
  const list = assignableRoles(roles, canCreateOwner);
  const current = roles.find((role) => role.id === currentRoleId);
  if (current && !list.some((role) => role.id === current.id)) {
    return [current, ...list];
  }
  return list;
}

export function PeopleView() {
  const { user } = useStaffSession();
  const router = useRouter();
  const people = useAsync(() => staffPeopleApi.list(), []);
  const roles = useAsync(() => staffRolesApi.list(), []);
  const [error, setError] = useState<string | null>(null);
  const [roleId, setRoleId] = useState("");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const canView = hasPerm(user, "people.view");
  const canCreate = hasPerm(user, "people.create");
  const canAssign = hasPerm(user, "people.assign_role");
  const canBlock = hasPerm(user, "people.block");
  const canCreateOwner = hasPerm(user, "people.create_owner");
  const canOpen = canView || canCreate || canAssign || canBlock;

  const choices = useMemo(
    () => assignableRoles(roles.data ?? [], canCreateOwner),
    [roles.data, canCreateOwner],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = people.data ?? [];
    if (!q) return rows;
    return rows.filter(
      (person) =>
        person.username.toLowerCase().includes(q) ||
        person.email.toLowerCase().includes(q) ||
        person.instagramUsername.toLowerCase().includes(q) ||
        person.roleName.toLowerCase().includes(q),
    );
  }, [people.data, query]);

  useEffect(() => {
    if (user && !canOpen) router.replace("/chat");
  }, [user, canOpen, router]);

  useEffect(() => {
    if (roleId || choices.length === 0) return;
    const member = choices.find((role) => role.slug === "member");
    setRoleId(member?.id ?? choices[0].id);
  }, [choices, roleId]);

  if (!canOpen) return <Loading label="People" />;
  if (people.loading || roles.loading) return <Loading label="People" />;
  if (people.error) {
    return <ErrorNote message={people.error} onRetry={people.reload} />;
  }

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
        roleId: roleId || undefined,
      });
      people.setData((prev) =>
        [...(prev ?? []), created].sort((a, b) =>
          a.username.localeCompare(b.username),
        ),
      );
      form.reset();
      setFormOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function changeRole(id: string, nextRoleId: string) {
    setError(null);
    try {
      const updated = await staffPeopleApi.changeRole(id, nextRoleId);
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
    <section className="flex flex-1 flex-col pb-8">
      <PageHeader
        eyebrow="Directory"
        title="People"
        description="Staff accounts are separate from the shop. Nobody can register themselves."
        actions={
          canCreate ? (
            <button
              type="button"
              className={`${btnSolid} w-full sm:w-auto`}
              onClick={() => setFormOpen((open) => !open)}
              aria-expanded={formOpen}
            >
              {formOpen ? "Close" : "New account"}
            </button>
          ) : undefined
        }
      />

      {canCreate && formOpen && (
        <form
          onSubmit={(e) => void create(e)}
          className={`grid gap-4 border-b border-subtle py-6 sm:grid-cols-2 ${pagePad}`}
        >
          <Field id="new-username" label="Username">
            <input
              id="new-username"
              name="username"
              required
              autoCapitalize="none"
              autoCorrect="off"
              className={inputCls}
            />
          </Field>
          <Field id="new-email" label="Email">
            <input
              id="new-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              inputMode="email"
              className={inputCls}
            />
          </Field>
          <Field id="new-ig" label="Instagram">
            <input
              id="new-ig"
              name="instagramUsername"
              required
              placeholder="@handle"
              autoCapitalize="none"
              autoCorrect="off"
              className={inputCls}
            />
          </Field>
          <Field
            id="new-password"
            label="Password"
            hint="At least 8 characters."
          >
            <input
              id="new-password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={inputCls}
            />
          </Field>
          <Field id="new-role" label="Role">
            <select
              id="new-role"
              className={`${selectCls} w-full`}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              {choices.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button type="submit" className={`${btnSolid} w-full sm:w-auto`}>
              Create account
            </button>
          </div>
        </form>
      )}

      <div className={`flex flex-col gap-4 py-6 ${pagePad}`}>
        <SearchInput
          id="people-search"
          value={query}
          onChange={setQuery}
          placeholder="Search name, email, role"
        />
        <Banner message={error ?? ""} tone="error" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={query ? "No matches" : "No people yet"}
          body={
            query
              ? "Try another search."
              : "Create the first staff account from this page."
          }
        />
      ) : (
        <ul className="divide-y divide-subtle border-y border-subtle">
          {filtered.map((person) => (
            <li
              key={person.id}
              className={`flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between ${pagePad}`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <Avatar name={person.username} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {person.username}
                    {person.isBlocked && (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.15em] text-muted">
                        Blocked
                      </span>
                    )}
                  </p>
                  <p className="mt-1 break-all text-sm text-muted">
                    {person.email}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    @{person.instagramUsername}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {canAssign ? (
                  <select
                    aria-label={`Role for ${person.username}`}
                    className={`${selectCls} w-full sm:w-44`}
                    value={person.roleId}
                    onChange={(e) => void changeRole(person.id, e.target.value)}
                  >
                    {roleOptions(
                      roles.data ?? [],
                      canCreateOwner,
                      person.roleId,
                    ).map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[11px] uppercase tracking-[0.15em] text-muted">
                    {person.roleName}
                  </span>
                )}
                {canBlock && person.id !== user?.id && (
                  <button
                    type="button"
                    className={`${btnOutline} w-full sm:w-auto`}
                    onClick={() =>
                      void setBlocked(person.id, !person.isBlocked)
                    }
                  >
                    {person.isBlocked ? "Unblock" : "Block"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
