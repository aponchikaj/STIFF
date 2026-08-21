import type { ContentKey, ContentListItem, ResolvedDrop } from "@/lib/api";
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

/**
 * The drop block with its state already resolved.
 *
 * Its own endpoint rather than `fetchContent("home-drop")` because the state
 * and the server's clock are worked out per request — the raw block on its own
 * would leave the page deciding whether the drop is open, which is the one
 * decision the browser must not make.
 *
 * `revalidate: 15` rather than the usual minute: this is the field that turns
 * a teaser into a live drop, and a minute of staleness at that moment is a
 * minute of people looking at a countdown that already finished.
 */
export async function fetchDrop(): Promise<ResolvedDrop | null> {
  try {
    const res = await fetch(`${serverApiBase()}/content/drop`, {
      next: { revalidate: 15 },
    });
    if (!res.ok) return null;
    return (await res.json()) as ResolvedDrop;
  } catch {
    return null;
  }
}
