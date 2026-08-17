import type { StaffRole } from './staff.constants';

export function isManager(role: StaffRole): boolean {
  return role === 'owner' || role === 'admin';
}

/** Who may mint a new staff account with this role. */
export function canCreateRole(actor: StaffRole, newRole: StaffRole): boolean {
  if (actor === 'owner') return true;
  if (actor === 'admin') return newRole === 'member';
  return false;
}

/** Only owners change roles. They may promote to owner. */
export function canAssignRole(actor: StaffRole): boolean {
  return actor === 'owner';
}

export function canBlockUser(
  actor: StaffRole,
  targetRole: StaffRole,
  actorId: string,
  targetId: string,
): boolean {
  if (actorId === targetId) return false;
  if (actor === 'owner') return true;
  if (actor === 'admin') return targetRole === 'member';
  return false;
}

export function canAssignTaskTo(
  actor: StaffRole,
  actorId: string,
  assigneeId: string,
): boolean {
  if (isManager(actor)) return true;
  return actorId === assigneeId;
}

export function canEditTask(
  actor: StaffRole,
  actorId: string,
  task: { assigneeId: string; createdById: string | null },
): boolean {
  if (isManager(actor)) return true;
  return task.assigneeId === actorId || task.createdById === actorId;
}

export function canDeleteTask(
  actor: StaffRole,
  actorId: string,
  task: { assigneeId: string; createdById: string | null },
): boolean {
  if (isManager(actor)) return true;
  return task.createdById === actorId && task.assigneeId === actorId;
}

export function normalizeInstagram(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export function dmKeyFor(a: string, b: string): string {
  return [a, b].sort().join(':');
}
