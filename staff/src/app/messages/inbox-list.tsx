"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  staffChatApi,
  type SafeStaffUser,
  type StaffConversation,
} from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { useStaffSession } from "@/components/providers";
import {
  Avatar,
  Banner,
  EmptyState,
  ErrorNote,
  Loading,
  SearchInput,
  pagePad,
} from "@/components/ui";

function matchesPerson(person: SafeStaffUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    person.username.toLowerCase().includes(q) ||
    person.email.toLowerCase().includes(q) ||
    person.instagramUsername.toLowerCase().includes(q) ||
    person.roleName.toLowerCase().includes(q)
  );
}

export function InboxList({
  activeId,
  showHeader = true,
}: {
  activeId?: string;
  showHeader?: boolean;
}) {
  const router = useRouter();
  const { user } = useStaffSession();
  const inbox = useAsync(() => staffChatApi.list(), []);
  const people = useAsync(() => staffChatApi.people(), []);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allDms = useMemo(
    () =>
      (inbox.data ?? []).filter(
        (conv): conv is StaffConversation & { peer: SafeStaffUser } =>
          conv.type === "dm" && conv.peer != null,
      ),
    [inbox.data],
  );

  const chats = useMemo(
    () => allDms.filter((conv) => matchesPerson(conv.peer, query)),
    [allDms, query],
  );

  const chattingIds = useMemo(
    () => new Set(allDms.map((conv) => conv.peer.id)),
    [allDms],
  );

  const startable = useMemo(() => {
    const rows = (people.data ?? []).filter(
      (person) =>
        person.id !== user?.id &&
        !person.isBlocked &&
        !chattingIds.has(person.id),
    );
    return rows.filter((person) => matchesPerson(person, query));
  }, [people.data, user?.id, chattingIds, query]);

  async function openWith(userId: string) {
    if (busyId) return;
    setBusyId(userId);
    setError(null);
    try {
      const conv = await staffChatApi.openDm(userId);
      router.push(`/messages/${conv.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusyId(null);
    }
  }

  if (inbox.loading || people.loading) {
    return <Loading label="Direct" />;
  }
  if (inbox.error) {
    return <ErrorNote message={inbox.error} onRetry={inbox.reload} />;
  }

  const empty = chats.length === 0 && startable.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showHeader && (
        <header className={`border-b border-subtle py-5 sm:py-6 ${pagePad}`}>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            Inbox
          </p>
          <h1 className="mt-1 text-2xl uppercase leading-none tracking-tight sm:text-3xl">
            Direct
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            Open a chat, or search someone and message them.
          </p>
        </header>
      )}

      <div className={`shrink-0 py-4 ${pagePad}`}>
        <SearchInput
          id="direct-search"
          value={query}
          onChange={setQuery}
          placeholder="Search chats and people"
        />
        <div className="mt-3">
          <Banner message={error ?? ""} tone="error" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {empty ? (
          <EmptyState
            title={query ? "No matches" : "No one to message yet"}
            body={
              query
                ? "Try another name or email."
                : "When other staff accounts exist, they will show up here."
            }
          />
        ) : (
          <>
            <section>
              <h2
                className={`pb-2 pt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted ${pagePad}`}
              >
                Chats
              </h2>
              {chats.length === 0 ? (
                <p className={`pb-4 text-sm text-muted ${pagePad}`}>
                  {query
                    ? "No chats match that search."
                    : "No chats yet. Message someone below."}
                </p>
              ) : (
                <ul className="divide-y divide-subtle border-y border-subtle">
                  {chats.map((conv) => {
                    const active = conv.id === activeId;
                    return (
                      <li key={conv.id}>
                        <Link
                          href={`/messages/${conv.id}`}
                          className={`flex min-h-16 items-center gap-3 py-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground ${pagePad} ${
                            active
                              ? "bg-foreground text-background"
                              : "hover:bg-surface"
                          }`}
                        >
                          <Avatar name={conv.peer.username} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="truncate text-sm font-medium">
                                {conv.peer.username}
                              </p>
                              {conv.lastMessage && (
                                <span
                                  className={`shrink-0 text-[11px] uppercase tracking-[0.12em] ${
                                    active ? "text-background/70" : "text-muted"
                                  }`}
                                >
                                  {formatRelative(conv.lastMessage.createdAt)}
                                </span>
                              )}
                            </div>
                            <p
                              className={`mt-1 truncate text-sm ${
                                active ? "text-background/80" : "text-muted"
                              }`}
                            >
                              {conv.lastMessage?.body ?? "No messages yet"}
                            </p>
                          </div>
                          {conv.unreadCount > 0 && !active && (
                            <span className="rounded-[2px] bg-foreground px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-background">
                              {conv.unreadCount}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="pb-6 pt-6">
              <h2
                className={`pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted ${pagePad}`}
              >
                Message someone
              </h2>
              {startable.length === 0 ? (
                <p className={`text-sm text-muted ${pagePad}`}>
                  {query
                    ? "No other people match that search."
                    : "Everyone else already has a chat with you."}
                </p>
              ) : (
                <ul className="divide-y divide-subtle border-y border-subtle">
                  {startable.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        disabled={busyId === person.id}
                        onClick={() => void openWith(person.id)}
                        className={`flex min-h-16 w-full items-center gap-3 py-3 text-left transition-colors duration-150 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground disabled:opacity-50 ${pagePad}`}
                      >
                        <Avatar name={person.username} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {person.username}
                          </p>
                          <p className="mt-1 truncate text-sm text-muted">
                            @{person.instagramUsername} · {person.roleName}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.15em] text-muted">
                          {busyId === person.id ? "Opening…" : "Message"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
