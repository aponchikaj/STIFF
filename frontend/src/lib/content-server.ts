import type { ContentKey, ContentListItem } from "@/lib/api";
import { serverApiBase } from "@/lib/site";

/**
 * Server-side read of one editable block.
 *
 * Server components use this rather than the browser client so edited copy is
 * in the first HTML paint — no flash of shipped copy, and crawlers see the real
 * text. The backend merges saved values over its registry defaults, so a
 * successful response is always complete; the fallbacks below only cover the
 * API being unreachable.
 */
export async function fetchContent(
  key: ContentKey,
): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${serverApiBase()}/content/${key}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    const body = (await res.json()) as { value?: Record<string, unknown> };
    return body.value ?? {};
  } catch {
    return {};
  }
}

export function contentText(
  value: Record<string, unknown>,
  field: string,
  fallback: string,
): string {
  const raw = value[field];
  return typeof raw === "string" && raw.trim() ? raw : fallback;
}

export function contentList(
  value: Record<string, unknown>,
  field: string,
  fallback: ContentListItem[],
): ContentListItem[] {
  const raw = value[field];
  if (!Array.isArray(raw)) return fallback;
  const items = raw.filter(
    (item): item is ContentListItem =>
      !!item &&
      typeof item === "object" &&
      typeof (item as ContentListItem).title === "string" &&
      typeof (item as ContentListItem).body === "string" &&
      (item as ContentListItem).title.trim().length > 0,
  );
  return items.length > 0 ? items : fallback;
}
