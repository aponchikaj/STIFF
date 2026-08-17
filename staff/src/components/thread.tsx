"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { staffChatApi, type StaffMessage, type SafeStaffUser } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { formatTime } from "@/lib/format";
import { connectStaffSocket } from "@/lib/socket";
import {
  Avatar,
  Banner,
  EmptyState,
  Loading,
  btnSolid,
  inputCls,
  pagePad,
} from "@/components/ui";
import { useStaffSession } from "@/components/providers";

export function Thread({
  conversationId,
  title,
  subtitle,
  backHref,
  backLabel,
}: {
  conversationId: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const { user } = useStaffSession();
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottom.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
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
      inputRef.current?.focus();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className={`shrink-0 border-b border-subtle py-4 sm:py-5 ${pagePad}`}>
        {backHref && (
          <Link
            href={backHref}
            className="mb-3 inline-flex min-h-11 items-center text-[11px] font-medium uppercase tracking-[0.18em] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground lg:hidden"
          >
            {backLabel ?? "Back"}
          </Link>
        )}
        {subtitle && (
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {subtitle}
          </p>
        )}
        <h1 className="mt-1 truncate text-2xl uppercase leading-none tracking-tight sm:text-3xl">
          {title}
        </h1>
      </header>

      <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-5 sm:py-6 ${pagePad}`}>
        {loading && <Loading label="Messages" />}
        {error && !loading && (
          <p role="alert" className="mb-4 text-sm leading-6 text-foreground">
            {error}
          </p>
        )}
        {!loading && messages.length === 0 && (
          <EmptyState
            title="No messages yet"
            body={
              backHref
                ? "Send the first message. Only the two of you can see this thread."
                : "Say hello. This thread is for everyone on staff."
            }
          />
        )}
        <ul className="mt-auto flex flex-col gap-4 sm:gap-5">
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
        className={`shrink-0 border-t border-subtle bg-background py-3 ${pagePad}`}
      >
        <Banner message={error ?? ""} tone="error" />
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <label htmlFor="thread-draft" className="sr-only">
            Message
          </label>
          <input
            id="thread-draft"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message"
            className={inputCls}
            maxLength={4000}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className={`${btnSolid} w-full md:w-auto`}
          >
            Send
          </button>
        </div>
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
    <li
      className={`flex max-w-[min(42rem,100%)] gap-3 ${mine ? "ml-auto flex-row-reverse" : ""}`}
    >
      <Avatar name={sender.username} size="sm" />
      <div className={`min-w-0 flex-1 ${mine ? "text-right" : ""}`}>
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
          {sender.username} · {formatTime(message.createdAt)}
        </p>
        <p
          className={`mt-1 inline-block max-w-full whitespace-pre-wrap break-words rounded-[2px] px-3 py-2.5 text-left text-sm leading-6 sm:px-4 sm:py-3 ${
            mine
              ? "bg-foreground text-background"
              : "border border-subtle bg-surface"
          }`}
        >
          {message.body}
        </p>
      </div>
    </li>
  );
}
