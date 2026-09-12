"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import {
  Badge,
  btnPrimary,
  Field,
  inputCls,
  Note,
  Panel,
  textareaCls,
} from "../ui";

export function BroadcastTab() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <Panel
        eyebrow="Broadcast"
        title="Send an in-app notification"
        className="max-w-2xl"
        aside={<Badge tone="info">Every active user</Badge>}
      >
        <form
          className="flex flex-col gap-4"
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
          <p className="text-[13px] leading-6 text-muted">
            This reaches every active shop account as a notification inside the
            site — no email is sent. Use it for drops, restocks and
            announcements.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <Field id="bc-title" label="Title" hint="Up to 120 characters.">
                <input
                  id="bc-title"
                  name="title"
                  required
                  maxLength={120}
                  placeholder="Drop 002 is live"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="bc-body" label="Message" hint="Up to 2000 characters.">
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
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? "Sending…" : "Broadcast"}
            </button>
            <Note>{note}</Note>
          </div>
        </form>
      </Panel>
    </div>
  );
}
