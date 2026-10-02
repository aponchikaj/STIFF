"use client";

/**
 * The account behind the player: session, settings, notifications.
 *
 * Distinct from the enrolment on purpose. An enrolment is per season and can
 * be demoted to watcher or marked a cheater; the account survives all of
 * that and is the same one stiff.ge uses. A screen showing "you" needs both.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, authApi, notificationsApi, profileApi } from "@/lib/api";
import type { UserSettings } from "@/lib/api/profile";
import { queryKeys } from "./keys";

/* -------------------------------------------------------------- session */

/**
 * Who is signed in, or nobody.
 *
 * `retry: false` because a 401 here is the answer, not a failure — this
 * query is how the app learns there is no session, and retrying it three
 * times only delays the sign-in screen by a second and a half.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me.user,
    queryFn: authApi.me,
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ emailOrUsername, password }: { emailOrUsername: string; password: string }) =>
      authApi.login(emailOrUsername, password),
    onSuccess: () => {
      // Everything cached was cached for a different person (or nobody).
      void qc.invalidateQueries();
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      // `clear`, not `invalidate`. Invalidating refetches, and refetching as
      // a signed-out user would repopulate the cache with 401s and, worse,
      // briefly leave the previous player's data on screen.
      qc.clear();
    },
  });
}

export function useRegisterShopAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: () => void qc.invalidateQueries(),
  });
}

export function useVerifyEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.me.all }),
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: authApi.resendVerification });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      authApi.resetPassword(token, newPassword),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => authApi.deleteAccount(password),
    onSuccess: () => qc.clear(),
  });
}

/** True only once the session question has actually been answered. A screen
 *  that treats "still loading" as "signed out" flashes the sign-in wall. */
export function useAuthState() {
  const query = useCurrentUser();
  const unauthorized =
    query.error instanceof ApiError && query.error.isUnauthorized;
  return {
    user: query.data ?? null,
    isSignedIn: Boolean(query.data),
    isResolved: query.isFetched || unauthorized,
    isLoading: query.isLoading,
  };
}

/* ------------------------------------------------------------- settings */

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.me.settings,
    queryFn: profileApi.settings,
    retry: false,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<UserSettings>) => profileApi.updateSettings(patch),
    onSuccess: (settings) => qc.setQueryData(queryKeys.me.settings, settings),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { username?: string; email?: string }) =>
      profileApi.updateProfile(patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.me.all }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      profileApi.changePassword(currentPassword, newPassword),
  });
}

/* -------------------------------------------------------- notifications */

export function useNotifications(query: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.notifications.list(query),
    queryFn: () => notificationsApi.list(query),
    retry: false,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useRemoveNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}
