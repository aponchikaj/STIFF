"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.messages.join(". ");
  return "Something went wrong. Is the server running?";
}

/** Minimal data-fetching hook: loading/error/reload, no cache.
 *  Pass `initial` to paint immediately from SSR data while a fresh
 *  request fills in viewer-specific fields (reactions, etc.). */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  initial: T | null = null,
) {
  const [data, setData] = useState<T | null>(initial);
  const [loading, setLoading] = useState(initial == null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    if (initial == null) {
      setLoading(true);
      setError(null);
    }
    fn()
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active && initial == null) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, setData, loading, error, reload };
}
