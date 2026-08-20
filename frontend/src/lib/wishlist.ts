"use client";

import { useCallback, useEffect, useState } from "react";
import { customersApi } from "@/lib/api";

/**
 * Saved pieces, for signed-in people and signed-out ones alike.
 *
 * Saving something should not require an account — that is a tax on the exact
 * moment someone decides they want the thing — and making an account later
 * should not lose what was saved. So a signed-out list lives in localStorage
 * and is folded into the account on the next sign-in, the same bargain the
 * guest cart already makes.
 */

const STORAGE_KEY = "stiff_wishlist";

/** Keeps a stale browser from posting a merge of thousands of ids. */
const MAX_LOCAL = 200;

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is string => typeof id === "string")
      .slice(0, MAX_LOCAL);
  } catch {
    // Private mode, a quota error, or something else wrote nonsense here.
    // A wishlist is not worth an exception.
    return [];
  }
}

function writeLocal(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(ids.slice(0, MAX_LOCAL)),
    );
  } catch {
    // Same: storage being unavailable must not break the button.
  }
}

export function clearLocalWishlist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignored
  }
}

export function localWishlist(): string[] {
  return readLocal();
}

/** Fires when the list changes, so every heart on the page agrees. */
const CHANGED = "stiff:wishlist";

function announce(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: ids }));
}

/**
 * The saved set, and a toggle.
 *
 * Signed in it is the server's list; signed out it is the browser's. The
 * component using it does not need to know which.
 */
export function useWishlist(signedIn: boolean) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!signedIn) {
      setIds(readLocal());
      setReady(true);
      return;
    }
    try {
      const { productIds } = await customersApi.wishlistIds();
      setIds(productIds);
    } catch {
      // Signed in but the request failed — an empty heart is a better lie
      // than a filled one, because clicking it re-saves rather than deletes.
      setIds([]);
    } finally {
      setReady(true);
    }
  }, [signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  // Every mounted heart listens, so saving from a card updates the one on the
  // product page behind it without a refetch.
  useEffect(() => {
    const onChanged = (e: Event) => {
      setIds((e as CustomEvent<string[]>).detail);
    };
    window.addEventListener(CHANGED, onChanged);
    return () => window.removeEventListener(CHANGED, onChanged);
  }, []);

  const toggle = useCallback(
    async (productId: string) => {
      const saved = ids.includes(productId);
      const next = saved
        ? ids.filter((id) => id !== productId)
        : [productId, ...ids];

      // Optimistic: the heart is the whole feedback, so waiting on a round
      // trip to fill it makes the button feel broken.
      setIds(next);
      announce(next);

      if (!signedIn) {
        writeLocal(next);
        return;
      }
      try {
        await customersApi.toggleWishlist(productId);
      } catch {
        setIds(ids);
        announce(ids);
      }
    },
    [ids, signedIn],
  );

  return { ids, ready, toggle, reload: load };
}

/**
 * Hands a signed-out list to the account that just signed in.
 *
 * Safe to call on every sign-in: with nothing stored it does nothing.
 */
export async function mergeLocalWishlist(): Promise<void> {
  const local = readLocal();
  if (local.length === 0) return;
  try {
    const { productIds } = await customersApi.mergeWishlist(local);
    clearLocalWishlist();
    announce(productIds);
  } catch {
    // Keep the local copy so the next sign-in tries again.
  }
}
