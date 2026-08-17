"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { staffAuthApi, type SafeStaffUser } from "@/lib/api";

interface SessionState {
  user: SafeStaffUser | null;
  loading: boolean;
  setUser: (user: SafeStaffUser | null) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function useStaffSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useStaffSession must be used inside <Providers>");
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeStaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    staffAuthApi
      .me()
      .then((me) => {
        if (active) setUser(me);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await staffAuthApi.logout();
    } catch {
      // local state is what matters
    }
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
