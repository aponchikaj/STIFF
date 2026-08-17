export const STAFF_JWT_AUDIENCE = 'stiff-staff';
export const STAFF_JWT_ISSUER = 'stiff-staff';

export const STAFF_ACCESS_COOKIE = 'stiff_staff_access';
export const STAFF_REFRESH_COOKIE = 'stiff_staff_refresh';

export const STAFF_ACCESS_TTL_MS = 15 * 60 * 1000;
export const STAFF_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const STAFF_MAIN_CHANNEL_KEY = 'main';

export const IS_STAFF_AREA_KEY = 'isStaffArea';

export const STAFF_ROLES = ['owner', 'admin', 'member'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type StaffTaskStatus = (typeof STAFF_TASK_STATUSES)[number];
