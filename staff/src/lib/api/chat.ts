import { apiFetch } from "./client";
import type {
  Paginated,
  SafeStaffUser,
  StaffConversation,
  StaffMessage,
} from "./types";

export const staffChatApi = {
  list() {
    return apiFetch<StaffConversation[]>("/staff/chat");
  },

  main() {
    return apiFetch<StaffConversation>("/staff/chat/main");
  },

  openDm(userId: string) {
    return apiFetch<StaffConversation>("/staff/chat/dm", {
      method: "POST",
      body: { userId },
    });
  },

  messages(conversationId: string, page = 1, pageSize = 40) {
    return apiFetch<Paginated<StaffMessage>>(
      `/staff/chat/${conversationId}/messages`,
      { query: { page, pageSize } },
    );
  },

  send(conversationId: string, body: string) {
    return apiFetch<StaffMessage>(`/staff/chat/${conversationId}/messages`, {
      method: "POST",
      body: { body },
    });
  },

  markRead(conversationId: string) {
    return apiFetch<{ success: boolean }>(
      `/staff/chat/${conversationId}/read`,
      { method: "POST", body: {} },
    );
  },

  people() {
    return apiFetch<SafeStaffUser[]>("/staff/people");
  },
};
