"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { notificationsApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import { XIcon } from "@/components/icons";
import { Reveal } from "@/components/motion";
import { useSession } from "@/components/providers";
import { btnGhostSm, ErrorNote, Loading } from "@/components/ui";

export function NotificationsView() {
  const { user, loading: sessionLoading, refreshBadges } = useSession();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(
    () =>
      user
        ? notificationsApi.listNotifications({ page, pageSize: 15 })
        : Promise.resolve(null),
    [user?.id, page],
  );

  useEffect(() => {
    if (!sessionLoading && !user) router.replace("/login?next=/notifications");
  }, [sessionLoading, user, router]);

  if (sessionLoading || !user) return <Loading label="Loading" />;

  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / 15));

  async function markRead(id: string) {
    await notificationsApi.markRead(id);
    reload();
    void refreshBadges();
  }

  return (
    <div>
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
          Inbox
        </h1>
        {data && data.unreadCount > 0 && (
          <button
            type="button"
            onClick={async () => {
              await notificationsApi.markAllRead();
              reload();
              void refreshBadges();
            }}
            className={btnGhostSm}
          >
            Mark all read ({data.unreadCount})
          </button>
        )}
      </Reveal>

      {loading && <Loading label="Loading notifications" />}
      {error && <ErrorNote message={error} />}
      {data && data.items.length === 0 && (
        <p className="mt-10 text-sm text-muted">
          Nothing here yet. Order updates and replies will land in this inbox.
        </p>
      )}

      <ul className="mt-8 border-t border-subtle">
        {data?.items.map((n) => (
          <li
            key={n.id}
            className={`flex items-start gap-3 border-b border-subtle py-5 ${
              n.isRead ? "opacity-60" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => (n.isRead ? undefined : markRead(n.id))}
              className="flex-1 rounded-[2px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {!n.isRead && (
                  <span
                    aria-label="Unread"
                    className="size-2 shrink-0 rounded-full bg-foreground"
                  />
                )}
                <p className="text-xs font-bold uppercase tracking-wide">
                  {n.title}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                  {formatDate(n.createdAt)}
                </p>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted">{n.body}</p>
              {n.meta?.targetType === "product" && n.meta.targetId && (
                <Link
                  href="/clothing"
                  className="mt-1 inline-block text-[11px] font-medium uppercase tracking-[0.15em] text-foreground underline-offset-4 hover:underline"
                >
                  View piece
                </Link>
              )}
            </button>
            <button
              type="button"
              aria-label="Delete notification"
              onClick={async () => {
                await notificationsApi.deleteNotification(n.id);
                reload();
                void refreshBadges();
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded-[2px] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
            >
              <XIcon className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      {pageCount > 1 && (
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className={btnGhostSm}
          >
            ← Newer
          </button>
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className={btnGhostSm}
          >
            Older →
          </button>
        </div>
      )}
    </div>
  );
}
