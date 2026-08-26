"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { btnSolid, Field, inputCls, textareaCls } from "../ui";

export function BroadcastTab() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <form
      className="flex max-w-xl flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setNote(null);
        try {
          const result = await adminApi.broadcast(
            String(data.get("title") ?? ""),
            String(data.get("body") ?? ""),
          );
          form.reset();
          setNote(`Sent to ${result.sent} users.`);
        } catch (err) {
          setNote(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm leading-6 text-muted">
        Send an in-app notification to every active user. Use it for drops,
        restocks and announcements.
      </p>
      <Field id="bc-title" label="Title">
        <input
          id="bc-title"
          name="title"
          required
          maxLength={120}
          placeholder="Drop 002 is live"
          className={inputCls}
        />
      </Field>
      <Field id="bc-body" label="Message">
        <textarea
          id="bc-body"
          name="body"
          required
          rows={4}
          maxLength={2000}
          placeholder="What should everyone know?"
          className={textareaCls}
        />
      </Field>
      <button type="submit" disabled={busy} className={`${btnSolid} self-start`}>
        {busy ? "Sending…" : "Broadcast"}
      </button>
      <p aria-live="polite" className="min-h-5 text-xs text-muted">
        {note}
      </p>
    </form>
  );
}
