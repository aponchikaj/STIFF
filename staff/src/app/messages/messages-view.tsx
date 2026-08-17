"use client";

import { InboxList } from "./inbox-list";

export function MessagesView() {
  return (
    <section className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:max-w-md lg:border-r lg:border-subtle">
        <InboxList />
      </div>
      <div className="hidden min-w-0 flex-1 items-center justify-center p-8 text-center lg:flex">
        <p className="max-w-xs text-sm leading-6 text-muted">
          Pick a chat, or search someone and send them a message.
        </p>
      </div>
    </section>
  );
}
