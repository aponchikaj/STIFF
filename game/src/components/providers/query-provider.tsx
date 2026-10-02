"use client";

import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The game is a live thing: a board, a clock, a pool of coins. A
        // minute of staleness is a wrong number on screen, so the default
        // is short and the few genuinely static queries opt out upward.
        staleTime: 10_000,
        gcTime: 5 * 60_000,

        // Refetching on focus is right here — a phone that has been in a
        // pocket for ten minutes is showing a dead clock.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,

        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            // 401/403 are answers. 429 means the backend is already
            // throttling us and retrying makes it worse. 4xx in general
            // will not fix itself.
            if (error.status >= 400 && error.status < 500) return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        // Never auto-retry a mutation. Every mutating route here either
        // spends coins, burns a heart or hands in work against a clock.
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // On the server every request needs its own client, or one visitor's
  // dashboard is served to the next. In the browser there is exactly one,
  // kept across re-renders so a suspense boundary does not drop the cache.
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(getQueryClient);
  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
