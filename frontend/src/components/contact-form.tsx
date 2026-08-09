"use client";

import { useState } from "react";
import { contentApi } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { Magnetic } from "./motion";
import { btnSolid, Field, inputCls, textareaCls } from "./ui";

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setStatus(null);
    try {
      await contentApi.submitContact({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        subject: String(data.get("subject") ?? "") || undefined,
        message: String(data.get("message") ?? ""),
      });
      form.reset();
      setStatus("Sent. We read everything — you'll hear back soon.");
    } catch (err) {
      setStatus(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field id="contact-name" label="Name">
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="Your name"
          className={inputCls}
        />
      </Field>
      <Field id="contact-email" label="Email">
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputCls}
        />
      </Field>
      <Field id="contact-subject" label="Subject (optional)">
        <input
          id="contact-subject"
          name="subject"
          type="text"
          maxLength={200}
          placeholder="What is it about"
          className={inputCls}
        />
      </Field>
      <Field id="contact-message" label="Message">
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          maxLength={5000}
          placeholder="What's on your mind"
          className={textareaCls}
        />
      </Field>
      <Magnetic className="self-start">
        <button type="submit" disabled={busy} className={btnSolid}>
          {busy ? "Sending…" : "Send"}
        </button>
      </Magnetic>
      <p aria-live="polite" className="min-h-5 text-xs text-muted">
        {status}
      </p>
    </form>
  );
}
