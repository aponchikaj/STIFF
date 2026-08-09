import { apiFetch } from "./client";
import type { SearchResults } from "./types";

export function search(q: string): Promise<SearchResults> {
  return apiFetch("/search", { query: { q } });
}
