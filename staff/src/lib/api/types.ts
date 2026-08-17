export type StaffPermission =
  | "people.view"
  | "people.create"
  | "people.create_owner"
  | "people.assign_role"
  | "people.block"
  | "roles.manage"
  | "tasks.view_others"
  | "tasks.assign"
  | "tasks.edit_others"
  | "tasks.delete_others";

export type StaffTaskStatus = "todo" | "in_progress" | "done";

export interface StaffPermissionMeta {
  key: StaffPermission;
  label: string;
  group: string;
}

export interface StaffRole {
  id: string;
  name: string;
  slug: string;
  isOwner: boolean;
  isSystem: boolean;
  permissions: StaffPermission[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SafeStaffUser {
  id: string;
  username: string;
  email: string;
  instagramUsername: string;
  role: string;
  roleName: string;
  roleId: string;
  isOwner: boolean;
  permissions: StaffPermission[];
  isBlocked: boolean;
  createdAt: string;
}

export function hasPerm(
  user: SafeStaffUser | null | undefined,
  permission: StaffPermission,
): boolean {
  if (!user) return false;
  return user.isOwner || user.permissions.includes(permission);
}

export interface StaffMessage {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  sender: SafeStaffUser;
}

export interface StaffConversation {
  id: string;
  type: "main" | "dm";
  lastMessage: StaffMessage | null;
  unreadCount: number;
  peer: SafeStaffUser | null;
  updatedAt: string;
}

export interface StaffTask {
  id: string;
  title: string;
  description: string;
  status: StaffTaskStatus;
  position: number;
  assigneeId: string;
  assigneeUsername: string;
  createdById: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffNote {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: SafeStaffUser;
  accessToken: string;
  refreshToken: string;
}
