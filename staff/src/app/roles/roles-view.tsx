"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  hasPerm,
  staffRolesApi,
  type StaffPermission,
  type StaffPermissionMeta,
  type StaffRole,
} from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import { useStaffSession } from "@/components/providers";
import {
  Banner,
  ErrorNote,
  Field,
  Loading,
  PageHeader,
  btnOutline,
  btnSolid,
  btnSolidSm,
  inputCls,
  pagePad,
} from "@/components/ui";

function groupedCatalog(catalog: StaffPermissionMeta[]) {
  const groups: { group: string; items: StaffPermissionMeta[] }[] = [];
  for (const item of catalog) {
    const existing = groups.find((entry) => entry.group === item.group);
    if (existing) existing.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return groups;
}

function PermissionPicker({
  idPrefix,
  catalog,
  selected,
  disabled,
  onToggle,
}: {
  idPrefix: string;
  catalog: StaffPermissionMeta[];
  selected: StaffPermission[];
  disabled?: boolean;
  onToggle: (key: StaffPermission, on: boolean) => void;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {groupedCatalog(catalog).map((group) => (
        <fieldset key={group.group} className="flex flex-col gap-1">
          <legend className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {group.group}
          </legend>
          {group.items.map((item) => {
            const inputId = `${idPrefix}-${item.key}`;
            return (
              <label
                key={item.key}
                htmlFor={inputId}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-5"
              >
                <input
                  id={inputId}
                  type="checkbox"
                  className="size-5 shrink-0 accent-foreground"
                  checked={selected.includes(item.key)}
                  disabled={disabled}
                  onChange={(e) => onToggle(item.key, e.target.checked)}
                />
                <span>{item.label}</span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}

export function RolesView() {
  const { user } = useStaffSession();
  const router = useRouter();
  const canManage = hasPerm(user, "roles.manage");
  const catalog = useAsync(() => staffRolesApi.catalog(), []);
  const roles = useAsync(() => staffRolesApi.list(), []);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPerms, setNewPerms] = useState<StaffPermission[]>([]);
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; permissions: StaffPermission[] }>
  >({});

  useEffect(() => {
    if (user && !canManage) router.replace("/chat");
  }, [user, canManage, router]);

  const catalogItems = useMemo(() => catalog.data ?? [], [catalog.data]);

  const syncedDrafts = useMemo(() => {
    const next: Record<
      string,
      { name: string; permissions: StaffPermission[] }
    > = {};
    for (const role of roles.data ?? []) {
      next[role.id] = drafts[role.id] ?? {
        name: role.name,
        permissions: role.isOwner
          ? catalogItems.map((item) => item.key)
          : [...role.permissions],
      };
    }
    return next;
  }, [roles.data, drafts, catalogItems]);

  if (!canManage) return <Loading label="Roles" />;
  if (catalog.loading || roles.loading) return <Loading label="Roles" />;
  if (catalog.error) {
    return <ErrorNote message={catalog.error} onRetry={catalog.reload} />;
  }
  if (roles.error) {
    return <ErrorNote message={roles.error} onRetry={roles.reload} />;
  }

  function toggleNew(key: StaffPermission, on: boolean) {
    setNewPerms((prev) =>
      on ? [...prev, key] : prev.filter((item) => item !== key),
    );
  }

  function patchDraft(
    id: string,
    patch: Partial<{ name: string; permissions: StaffPermission[] }>,
  ) {
    const current = syncedDrafts[id];
    if (!current) return;
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...current, ...patch },
    }));
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      const created = await staffRolesApi.create({
        name: newName,
        permissions: newPerms,
      });
      roles.setData((prev) =>
        [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewName("");
      setNewPerms([]);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function save(role: StaffRole) {
    const draft = syncedDrafts[role.id];
    if (!draft) return;
    setError(null);
    try {
      const updated = await staffRolesApi.update(role.id, {
        name: draft.name,
        permissions: role.isOwner ? undefined : draft.permissions,
      });
      roles.setData((prev) =>
        (prev ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[role.id];
        return next;
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(role: StaffRole) {
    setError(null);
    try {
      await staffRolesApi.remove(role.id);
      roles.setData((prev) =>
        (prev ?? []).filter((item) => item.id !== role.id),
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[role.id];
        return next;
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="flex flex-1 flex-col pb-10">
      <PageHeader
        eyebrow="Access"
        title="Roles"
        description="Name a role, then tick the functions it can use. Owner always has every function."
      />

      <form
        onSubmit={(e) => void create(e)}
        className={`flex flex-col gap-6 border-b border-subtle py-6 ${pagePad}`}
      >
        <Field id="role-name" label="New role">
          <input
            id="role-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            minLength={2}
            maxLength={40}
            placeholder="Packing"
            className={inputCls}
          />
        </Field>
        <PermissionPicker
          idPrefix="new"
          catalog={catalogItems}
          selected={newPerms}
          onToggle={toggleNew}
        />
        <div>
          <button type="submit" className={`${btnSolid} w-full sm:w-auto`}>
            Create role
          </button>
        </div>
      </form>
      <div className={`${pagePad} pt-4`}>
        <Banner message={error ?? ""} tone="error" />
      </div>

      <ul className={`mt-4 flex flex-col gap-4 sm:gap-6 ${pagePad}`}>
        {(roles.data ?? []).map((role) => {
          const draft = syncedDrafts[role.id];
          return (
            <li key={role.id} className="border border-subtle p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <Field id={`role-name-${role.id}`} label="Name">
                  <input
                    id={`role-name-${role.id}`}
                    value={draft?.name ?? role.name}
                    onChange={(e) =>
                      patchDraft(role.id, { name: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted sm:pb-3">
                  {role.isOwner ? "Owner · every function" : role.slug}
                </p>
              </div>
              <div className="mt-6">
                <PermissionPicker
                  idPrefix={role.id}
                  catalog={catalogItems}
                  selected={draft?.permissions ?? role.permissions}
                  disabled={role.isOwner}
                  onToggle={(key, on) => {
                    const current = draft?.permissions ?? role.permissions;
                    patchDraft(role.id, {
                      permissions: on
                        ? [...current, key]
                        : current.filter((item) => item !== key),
                    });
                  }}
                />
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  className={`${btnSolidSm} w-full sm:w-auto`}
                  onClick={() => void save(role)}
                >
                  Save
                </button>
                {!role.isOwner && !role.isSystem && (
                  <button
                    type="button"
                    className={`${btnOutline} w-full sm:w-auto`}
                    onClick={() => void remove(role)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
