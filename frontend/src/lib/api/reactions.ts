import { apiFetch } from "./client";
import type { ReactionResult, ReactionType, TargetType } from "./types";

export function toggleReaction(
  targetType: TargetType,
  targetId: string,
  type: ReactionType,
): Promise<ReactionResult> {
  return apiFetch("/reactions/toggle", {
    method: "POST",
    body: { targetType, targetId, type },
  });
}
