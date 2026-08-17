"use client";

import { useParams } from "next/navigation";
import { staffChatApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { ErrorNote, Loading } from "@/components/ui";
import { Thread } from "@/components/thread";

export function DmView() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const inbox = useAsync(() => staffChatApi.list(), [id]);
  const conv = inbox.data?.find((c) => c.id === id);

  if (inbox.loading) return <Loading label="Messages" />;
  if (inbox.error) return <ErrorNote message={inbox.error} />;
  if (!conv) return <ErrorNote message="Conversation not found" />;

  return (
    <Thread
      conversationId={conv.id}
      title={conv.peer?.username ?? "Direct"}
      subtitle={conv.peer ? `@${conv.peer.instagramUsername}` : "DM"}
    />
  );
}
