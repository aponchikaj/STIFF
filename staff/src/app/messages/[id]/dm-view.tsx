"use client";

import { useParams } from "next/navigation";
import { staffChatApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { ErrorNote, Loading } from "@/components/ui";
import { Thread } from "@/components/thread";
import { InboxList } from "../inbox-list";

export function DmView() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const conversation = useAsync(() => staffChatApi.get(id), [id]);

  if (conversation.loading) return <Loading label="Messages" />;
  if (conversation.error) {
    return (
      <ErrorNote message={conversation.error} onRetry={conversation.reload} />
    );
  }
  if (!conversation.data || conversation.data.type !== "dm") {
    return <ErrorNote message="That chat could not be found." />;
  }

  const conv = conversation.data;

  return (
    <section className="flex min-h-0 flex-1">
      <div className="hidden min-h-0 w-full max-w-md shrink-0 flex-col border-r border-subtle lg:flex">
        <InboxList activeId={conv.id} showHeader />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Thread
          conversationId={conv.id}
          title={conv.peer?.username ?? "Direct"}
          subtitle={
            conv.peer ? `@${conv.peer.instagramUsername}` : "Private chat"
          }
          backHref="/messages"
          backLabel="Direct"
        />
      </div>
    </section>
  );
}
