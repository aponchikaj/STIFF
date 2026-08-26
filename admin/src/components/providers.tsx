"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { authApi, contentApi, SESSION_ENDED_EVENT } from "@/lib/api";
import type { AdminLoginInput } from "@/lib/api/auth";
import type { SafeUser } from "@/lib/api";

interface SessionState {
  user: SafeUser | null;
  /** True until the initial session check settles. */
  loading: boolean;
  /** Whether the shop is currently visible to the public. */
  shopEnabled: boolean;
  login: (input: AdminLoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshFeatures: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <Providers>");
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopEnabled, setShopEnabled] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      setUser(await authApi.getMe());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const refreshFeatures = useCallback(async () => {
    try {
      const content = await contentApi.getContent("features");
      const value = content.value as { shopEnabled?: boolean };
      setShopEnabled(value.shopEnabled !== false);
    } catch {
      // Not configured yet (404) or backend down — assume visible.
      setShopEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (user) void refreshFeatures();
  }, [user, refreshFeatures]);

  /**
   * The client fires this when a request 401s and the refresh could not bring
   * the session back. Without it an expired session shows up as every panel
   * failing at once, and nothing saying why.
   */
  useEffect(() => {
    function onSessionEnded() {
      setUser(null);
      setLoading(false);
      router.replace("/login");
    }
    window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
  }, [router]);

  const login = useCallback(async (input: AdminLoginInput) => {
    const { user: signedIn } = await authApi.login(input);
    setUser(signedIn);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Clearing local state is what matters; the cookie is gone either way.
    }
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        user,
        loading,
        shopEnabled,
        login,
        logout,
        refreshUser,
        refreshFeatures,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
