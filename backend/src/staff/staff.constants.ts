export const STAFF_JWT_AUDIENCE = 'stiff-staff';
export const STAFF_JWT_ISSUER = 'stiff-staff';

export const STAFF_ACCESS_COOKIE = 'stiff_staff_access';
export const STAFF_REFRESH_COOKIE = 'stiff_staff_refresh';

export const STAFF_ACCESS_TTL_MS = 15 * 60 * 1000;
export const STAFF_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const STAFF_MAIN_CHANNEL_KEY = 'main';

export const IS_STAFF_AREA_KEY = 'isStaffArea';

export const STAFF_OWNER_SLUG = 'owner';
export const STAFF_ADMIN_SLUG = 'admin';
export const STAFF_MEMBER_SLUG = 'member';

export const STAFF_TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type StaffTaskStatus = (typeof STAFF_TASK_STATUSES)[number];

export const STAFF_PERMISSION_KEYS = [
  'people.view',
  'people.create',
  'people.create_owner',
  'people.assign_role',
  'people.block',
  'roles.manage',
  'tasks.view_others',
  'tasks.assign',
  'tasks.edit_others',
  'tasks.delete_others',
] as const;

export type StaffPermission = (typeof STAFF_PERMISSION_KEYS)[number];

export interface StaffPermissionMeta {
  key: StaffPermission;
  label: string;
  group: string;
}

export const STAFF_PERMISSION_CATALOG: StaffPermissionMeta[] = [
  { key: 'people.view', label: 'View people', group: 'People' },
  { key: 'people.create', label: 'Create staff accounts', group: 'People' },
  {
    key: 'people.create_owner',
    label: 'Create owner accounts',
    group: 'People',
  },
  { key: 'people.assign_role', label: 'Assign roles', group: 'People' },
  { key: 'people.block', label: 'Block and unblock accounts', group: 'People' },
  {
    key: 'roles.manage',
    label: 'Create, name, and edit roles',
    group: 'Roles',
  },
  { key: 'tasks.view_others', label: 'See other boards', group: 'Tasks' },
  { key: 'tasks.assign', label: 'Assign tasks to others', group: 'Tasks' },
  { key: 'tasks.edit_others', label: 'Edit others’ tasks', group: 'Tasks' },
  { key: 'tasks.delete_others', label: 'Delete others’ tasks', group: 'Tasks' },
];

export const ADMIN_PERMISSIONS: StaffPermission[] = [
  'people.view',
  'people.create',
  'people.block',
  'tasks.view_others',
  'tasks.assign',
  'tasks.edit_others',
  'tasks.delete_others',
];
