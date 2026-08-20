"use client";

import { useWishlist } from "@/lib/wishlist";
import { BookmarkIcon } from "./icons";
import { useSession } from "./providers";

/**
 * Save a piece for later.
 *
 * Deliberately not the like button. A like is a public signal that drives the
 * "popular" sort and shows a count to everyone; this is private intent.
 * Conflating them loses both — people withhold likes on things they want kept
 * quiet, and the popularity sort fills up with bookmarks.
 *
 * Works signed out, holding the list in the browser until there is an account
 * to hand it to. Making someone register at the moment they decide they want
 * something is the worst possible moment to ask.
 */
export function SaveButton({
  productId,
  productName,
  variant = "inline",
}: {
  productId: string;
  productName: string;
  /** `overlay` sits on a product card image; `inline` sits in a row of controls. */
  variant?: "inline" | "overlay";
}) {
  const { user } = useSession();
  const { ids, ready, toggle } = useWishlist(!!user);
  const saved = ids.includes(productId);

  const label = saved ? `Saved: ${productName}` : `Save ${productName}`;

  if (variant === "overlay") {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={saved}
        title={saved ? "Saved" : "Save for later"}
        onClick={(e) => {
          // The card is a link; saving must not navigate.
          e.preventDefault();
          e.stopPropagation();
          void toggle(productId);
        }}
        className={`flex size-9 items-center justify-center rounded-[2px] bg-background/85 text-foreground backdrop-blur transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
          // Until the list has loaded, an empty bookmark is the safer lie:
          // clicking it re-saves, where a wrongly filled one would delete.
          ready ? "opacity-100" : "opacity-0"
        }`}
      >
        <BookmarkIcon className="size-4" filled={saved} />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => void toggle(productId)}
      className="flex h-9 items-center gap-2 rounded-[2px] border border-subtle px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted aria-pressed:border-foreground aria-pressed:text-foreground"
    >
      <BookmarkIcon className="size-4" filled={saved} />
      {saved ? "Saved" : "Save"}
    </button>
  );
}
