import { apiFetch } from "./client";
import type { ContactInput, ContentKey, SiteContent } from "./types";

export function getContent(key: ContentKey): Promise<SiteContent> {
  return apiFetch(`/content/${key}`);
}

export function submitContact(
  data: ContactInput,
): Promise<{ success: boolean }> {
  return apiFetch("/contact", { method: "POST", body: data });
}
