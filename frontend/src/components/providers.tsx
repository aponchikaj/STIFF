"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { authApi, cartApi, contentApi, notificationsApi } from "@/lib/api";
import type { SafeUser } from "@/lib/api";
import { clearLocalWishlist } from "@/lib/wishlist";

interface SessionState {
  user: SafeUser | null;
  /** True until the initial /auth/me check settles. */
  loading: boolean;
  cartCount: number;
  unreadCount: number;
  /** Admin kill-switch: when false, the whole shop is hidden. */
  shopEnabled: boolean;
  setUser: (user: SafeUser | null) => void;
  refreshUser: () => Promise<void>;
  refreshBadges: () => Promise<void>;
  refreshFeatures: () => Promise<void>;
  logout: () => Promise<void>;
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
  const [cartCount, setCartCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [shopEnabled, setShopEnabled] = useState(true);

  const refreshFeatures = useCallback(async () => {
    try {
      const content = await contentApi.getContent("features");
      const value = content.value as { shopEnabled?: boolean };
      setShopEnabled(value.shopEnabled !== false);
    } catch {
      // not configured yet (404) or backend down — shop stays visible
      setShopEnabled(true);
    }
  }, []);

  useEffect(() => {
    void refreshFeatures();
  }, [refreshFeatures]);

  const refreshBadges = useCallback(async () => {
    try {
      const [cart, notifications] = await Promise.all([
        cartApi.getCart(),
        notificationsApi.listNotifications({ page: 1, pageSize: 1 }),
      ]);
      setCartCount(cart.items.reduce((sum, item) => sum + item.quantity, 0));
      setUnreadCount(notifications.unreadCount);
    } catch {
      // not logged in or backend down — badges stay at 0
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user) void refreshBadges();
    else {
      setCartCount(0);
      setUnreadCount(0);
    }
  }, [user, refreshBadges]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // clearing local state is what matters
    }
    // Not the previous account's list to hand to whoever signs in next.
    clearLocalWishlist();
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        user,
        loading,
        cartCount,
        unreadCount,
        shopEnabled,
        setUser,
        refreshUser,
        refreshBadges,
        refreshFeatures,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
