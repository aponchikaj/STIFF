import { apiFetch } from "./client";
import type {
  Comment,
  Paginated,
  PaginationParams,
  TargetType,
} from "./types";

export function listComments(
  targetType: TargetType,
  targetId: string,
  params?: PaginationParams,
): Promise<Paginated<Comment>> {
  return apiFetch("/comments", {
    query: { targetType, targetId, ...params },
  });
}

export function createComment(data: {
  targetType: TargetType;
  targetId: string;
  body: string;
  parentId?: string;
}): Promise<Comment> {
  return apiFetch("/comments", { method: "POST", body: data });
}

export function updateComment(id: string, body: string): Promise<Comment> {
  return apiFetch(`/comments/${id}`, { method: "PATCH", body: { body } });
}

export function deleteComment(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/comments/${id}`, { method: "DELETE" });
}
