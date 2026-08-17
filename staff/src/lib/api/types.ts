export type StaffRole = "owner" | "admin" | "member";
export type StaffTaskStatus = "todo" | "in_progress" | "done";

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
  role: StaffRole;
  isBlocked: boolean;
  createdAt: string;
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
