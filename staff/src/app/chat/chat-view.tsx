"use client";

import { staffChatApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { ErrorNote, Loading } from "@/components/ui";
import { Thread } from "@/components/thread";

export function ChatView() {
  const { data, loading, error } = useAsync(() => staffChatApi.main(), []);

  if (loading) return <Loading label="Chat" />;
  if (error || !data) return <ErrorNote message={error ?? "Chat unavailable"} />;

  return <Thread conversationId={data.id} title="Hall" subtitle="Everyone" />;
}
