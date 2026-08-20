import type { Paginated, PaginationParams } from "./types";

/**
 * The largest page the API will hand over.
 *
 * Mirrors `@Max(50)` on the backend's `PaginationDto`. Asking for more is not
 * clamped, it is a 400 — and a 400 inside a `useAsync` that renders an empty
 * state looks exactly like "there is nothing here". Three admin lists were
 * asking for 100 and had been quietly showing nothing for it.
 */
export const MAX_PAGE_SIZE = 50;

/** Stops a runaway loop if a listing ever reports a total it cannot serve. */
const MAX_PAGES = 40;

/**
 * Walks every page of a listing.
 *
 * For admin pickers, which need the whole catalogue rather than a screenful,
 * and where "the whole catalogue" is a few dozen rows.
 */
export async function fetchAll<T, P extends PaginationParams>(
  list: (params: P) => Promise<Paginated<T>>,
  params: Omit<P, "page" | "pageSize">,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await list({
      ...params,
      page,
      pageSize: MAX_PAGE_SIZE,
    } as P);
    rows.push(...result.items);
    if (rows.length >= result.total || result.items.length === 0) break;
  }
  return rows;
}
