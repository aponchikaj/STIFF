"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { GalleryTagWithCount, TagKind } from "@/lib/api";
import { chipCls } from "@/components/ui";

/**
 * The archive's filter bar.
 *
 * The state lives in the URL rather than in this component, so a filtered view
 * is a link: shareable, bookmarkable, and back-buttonable. That is also what
 * lets the server render the first page already filtered instead of shipping
 * everything and hiding most of it.
 *
 * Several tags narrow rather than widen. "Summer" and "Tbilisi" means both —
 * the only reading under which adding a second filter is worth doing.
 */

/** Reading order for the groups; anything unlisted falls to the end. */
const KIND_ORDER: TagKind[] = ["season", "location", "theme"];

const KIND_LABELS: Record<TagKind, string> = {
  season: "Season",
  location: "Place",
  theme: "Theme",
};

export function GalleryFilters({
  tags,
  active,
}: {
  tags: GalleryTagWithCount[];
  active: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const hrefWithout = useCallback(
    (slugs: string[]) => {
      const next = new URLSearchParams(params.toString());
      next.delete("tag");
      for (const slug of slugs) next.append("tag", slug);
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [params, pathname],
  );

  const toggle = useCallback(
    (slug: string) => {
      const next = active.includes(slug)
        ? active.filter((one) => one !== slug)
        : [...active, slug];
      // `scroll: false` because the chips are at the top: re-anchoring the
      // page on a filter change moves the bar out from under the pointer.
      router.push(hrefWithout(next), { scroll: false });
    },
    [active, hrefWithout, router],
  );

  if (tags.length === 0) return null;

  const groups = KIND_ORDER.map(
    (kind) => [kind, tags.filter((tag) => tag.kind === kind)] as const,
  ).filter(([, list]) => list.length > 0);

  return (
    <div className="mt-8 flex flex-col gap-4 border-y border-subtle py-5">
      {groups.map(([kind, list]) => (
        <div key={kind} className="flex flex-wrap items-center gap-2">
          <span
            id={`filter-${kind}`}
            className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-[0.2em] text-muted"
          >
            {KIND_LABELS[kind]}
          </span>
          <ul
            aria-labelledby={`filter-${kind}`}
            className="flex flex-wrap gap-2"
          >
            {list.map((tag) => {
              const on = active.includes(tag.slug);
              return (
                <li key={tag.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(tag.slug)}
                    className={chipCls(on)}
                  >
                    {tag.label}
                    <span
                      className={`ml-2 tabular-nums ${on ? "opacity-60" : "opacity-50"}`}
                    >
                      {tag.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {active.length > 0 && (
        <div className="flex items-center gap-4">
          <Link
            href={hrefWithout([])}
            scroll={false}
            className="rounded-[2px] text-[10px] font-medium uppercase tracking-[0.2em] text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            Clear {active.length} filter{active.length === 1 ? "" : "s"}
          </Link>
        </div>
      )}
    </div>
  );
}
