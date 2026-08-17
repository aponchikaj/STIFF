"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { staffChatApi } from "@/lib/api";
import { errorMessage, useAsync } from "@/lib/hooks";
import { useStaffSession } from "@/components/providers";
import { btnOutline, ErrorNote, Loading, selectCls } from "@/components/ui";

export function MessagesView() {
  const router = useRouter();
  const { user } = useStaffSession();
  const inbox = useAsync(() => staffChatApi.list(), []);
  const people = useAsync(() => staffChatApi.people(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dms = (inbox.data ?? []).filter((c) => c.type === "dm");
  const others = (people.data ?? []).filter((p) => p.id !== user?.id && !p.isBlocked);

  async function startDm(userId: string) {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const conv = await staffChatApi.openDm(userId);
      router.push(`/messages/${conv.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (inbox.loading) return <Loading label="Messages" />;
  if (inbox.error) return <ErrorNote message={inbox.error} />;

  return (
    <section className="flex flex-1 flex-col px-5 py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
        Direct
      </p>
      <h1 className="mt-1 text-3xl uppercase tracking-tight">Messages</h1>

      <form
        className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void startDm(String(data.get("userId") ?? ""));
        }}
      >
        <select name="userId" required className={selectCls}>
          <option value="">New message…</option>
          {others.map((person) => (
            <option key={person.id} value={person.id}>
              {person.username}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy} className={btnOutline}>
          Open
        </button>
      </form>
      {error && <p className="mt-3 text-xs text-muted">{error}</p>}

      <ul className="mt-10 divide-y divide-subtle border-y border-subtle">
        {dms.length === 0 && (
          <li className="py-8 text-sm text-muted">No direct messages yet.</li>
        )}
        {dms.map((conv) => (
          <li key={conv.id}>
            <Link
              href={`/messages/${conv.id}`}
              className="flex items-center justify-between gap-4 py-4 transition-opacity hover:opacity-70"
            >
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.12em]">
                  {conv.peer?.username ?? "Unknown"}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-muted">
                  {conv.lastMessage?.body ?? "No messages yet"}
                </p>
              </div>
              {conv.unreadCount > 0 && (
                <span className="rounded-[2px] bg-foreground px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-background">
                  {conv.unreadCount}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
