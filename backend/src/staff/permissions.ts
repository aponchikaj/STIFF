import type { StaffPermission } from './staff.constants';
import { STAFF_PERMISSION_KEYS } from './staff.constants';
import type { StaffUser } from './entities/staff-user.entity';

export function permissionSet(user: StaffUser): Set<StaffPermission> {
  if (user.assignedRole?.isOwner) return new Set(STAFF_PERMISSION_KEYS);
  return new Set(user.assignedRole?.permissions ?? []);
}

export function hasPermission(
  user: StaffUser,
  permission: StaffPermission,
): boolean {
  return permissionSet(user).has(permission);
}

export function isOwner(user: StaffUser): boolean {
  return user.assignedRole?.isOwner === true;
}

export function canViewOthersBoards(user: StaffUser): boolean {
  return hasPermission(user, 'tasks.view_others');
}

export function canAssignTaskTo(actor: StaffUser, assigneeId: string): boolean {
  if (actor.id === assigneeId) return true;
  return hasPermission(actor, 'tasks.assign');
}

export function canEditTask(
  actor: StaffUser,
  task: { assigneeId: string; createdById: string | null },
): boolean {
  if (task.assigneeId === actor.id || task.createdById === actor.id)
    return true;
  return hasPermission(actor, 'tasks.edit_others');
}

export function canDeleteTask(
  actor: StaffUser,
  task: { assigneeId: string; createdById: string | null },
): boolean {
  if (task.createdById === actor.id && task.assigneeId === actor.id)
    return true;
  return hasPermission(actor, 'tasks.delete_others');
}

export function canBlockUser(actor: StaffUser, target: StaffUser): boolean {
  if (actor.id === target.id) return false;
  if (!hasPermission(actor, 'people.block')) return false;
  if (isOwner(target) && !isOwner(actor)) return false;
  return true;
}

export function slugifyRoleName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'role';
}

export function normalizeInstagram(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export function dmKeyFor(a: string, b: string): string {
  return [a, b].sort().join(':');
}
