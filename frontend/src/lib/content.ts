"use client";

import { contentApi } from "@/lib/api";
import type { ContentKey, ContentListItem } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

/**
 * Reads one editable block. The backend already merges saved values over the
 * copy shipped in its registry, so `value` is always complete — these helpers
 * only guard against the request itself failing.
 */
export function useContent(key: ContentKey) {
  const { data } = useAsync(() => contentApi.getContent(key), [key]);
  const value = (data?.value ?? {}) as Record<string, unknown>;

  return {
    ready: data != null,
    text(field: string, fallback: string): string {
      const raw = value[field];
      return typeof raw === "string" && raw.trim() ? raw : fallback;
    },
    flag(field: string, fallback: boolean): boolean {
      const raw = value[field];
      return typeof raw === "boolean" ? raw : fallback;
    },
    list(field: string, fallback: ContentListItem[]): ContentListItem[] {
      const raw = value[field];
      if (!Array.isArray(raw) || raw.length === 0) return fallback;
      return raw.filter(
        (item): item is ContentListItem =>
          !!item &&
          typeof item === "object" &&
          typeof (item as ContentListItem).title === "string" &&
          typeof (item as ContentListItem).body === "string",
      );
    },
  };
}
