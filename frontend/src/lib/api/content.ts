import { apiFetch } from "./client";
import type {
  ContactInput,
  ContentBlock,
  ContentKey,
  ResolvedDrop,
  SiteContent,
} from "./types";

/** Never 404s — an unsaved block resolves to the copy shipped in the registry. */
export function getContent(key: ContentKey): Promise<SiteContent> {
  return apiFetch(`/content/${key}`);
}

export function getAllContent(): Promise<SiteContent[]> {
  return apiFetch("/content");
}

/** The field definitions the admin form renders itself from. */
export function getContentCatalog(): Promise<{ blocks: ContentBlock[] }> {
  return apiFetch("/content/catalog");
}

export function submitContact(
  data: ContactInput,
): Promise<{ success: boolean }> {
  return apiFetch("/contact", { method: "POST", body: data });
}

/** The drop, with its state resolved server-side. */
export function getDrop(): Promise<ResolvedDrop> {
  return apiFetch("/content/drop");
}
