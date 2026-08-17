export { ApiError, getAccessToken } from "./client";
export { staffAuthApi } from "./auth";
export { staffChatApi } from "./chat";
export { staffNotesApi } from "./notes";
export { staffPeopleApi } from "./people";
export { staffTasksApi } from "./tasks";
export type {
  AuthResponse,
  Paginated,
  SafeStaffUser,
  StaffConversation,
  StaffMessage,
  StaffNote,
  StaffRole,
  StaffTask,
  StaffTaskStatus,
} from "./types";
