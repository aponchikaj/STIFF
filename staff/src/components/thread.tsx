"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { staffChatApi, type StaffMessage, type SafeStaffUser } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { connectStaffSocket } from "@/lib/socket";
import { btnSolid, inputCls, Loading, ErrorNote } from "@/components/ui";
import { useStaffSession } from "@/components/providers";

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Thread({
  conversationId,
  title,
  subtitle,
}: {
  conversationId: string;
  title: string;
  subtitle?: string;
}) {
  const { user } = useStaffSession();
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    staffChatApi
      .messages(conversationId)
      .then(async (page) => {
        if (!active) return;
        setMessages(page.items);
        await staffChatApi.markRead(conversationId);
      })
      .catch((err: unknown) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [conversationId]);

  useEffect(() => {
    const socket = connectStaffSocket();
    socketRef.current = socket;
    if (!socket) return;
    socket.emit("join", { conversationId });
    const onMessage = (incoming: StaffMessage) => {
      if (incoming.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
      );
    };
    socket.on("message", onMessage);
    return () => {
      socket.off("message", onMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversationId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const saved = await staffChatApi.send(conversationId, body);
      setMessages((prev) =>
        prev.some((m) => m.id === saved.id) ? prev : [...prev, saved],
      );
      setDraft("");
      socketRef.current?.emit("join", { conversationId });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-subtle px-5 py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          {subtitle ?? "Channel"}
        </p>
        <h1 className="mt-1 text-3xl uppercase tracking-tight">{title}</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        {loading && <Loading label="Messages" />}
        {error && <ErrorNote message={error} />}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-muted">No messages yet.</p>
        )}
        <ul className="flex flex-col gap-5">
          {messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              mine={message.sender.id === user?.id}
            />
          ))}
        </ul>
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => void send(e)}
        className="flex gap-3 border-t border-subtle p-4"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message"
          className={inputCls}
          maxLength={4000}
        />
        <button type="submit" disabled={busy || !draft.trim()} className={btnSolid}>
          Send
        </button>
      </form>
    </section>
  );
}

function MessageRow({
  message,
  mine,
}: {
  message: StaffMessage;
  mine: boolean;
}) {
  const sender: SafeStaffUser = message.sender;
  return (
    <li className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
        {sender.username} · {formatTime(message.createdAt)}
      </p>
      <p
        className={`max-w-[min(42rem,90%)] rounded-[2px] px-4 py-3 text-sm leading-6 ${
          mine
            ? "bg-foreground text-background"
            : "border border-subtle bg-surface"
        }`}
      >
        {message.body}
      </p>
    </li>
  );
}
