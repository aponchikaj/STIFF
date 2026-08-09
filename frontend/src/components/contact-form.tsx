"use client";

import { useState } from "react";
import { Magnetic } from "./motion";

const inputClasses =
  "h-12 w-full rounded-[2px] border border-subtle bg-transparent px-4 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-foreground focus-visible:outline-none";

export function ContactForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "");
    const email = String(data.get("email") ?? "");
    const message = String(data.get("message") ?? "");
    const subject = encodeURIComponent(`Message from ${name}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:hello@stiff.com?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="contact-name"
          className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted"
        >
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="Your name"
          className={inputClasses}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label
          htmlFor="contact-email"
          className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted"
        >
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClasses}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label
          htmlFor="contact-message"
          className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          placeholder="What's on your mind"
          className="w-full rounded-[2px] border border-subtle bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-foreground focus-visible:outline-none"
        />
      </div>
      <Magnetic className="self-start">
        <button
          type="submit"
          className="flex h-12 items-center rounded-[2px] bg-foreground px-8 text-xs font-bold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Send
        </button>
      </Magnetic>
      <p aria-live="polite" className="min-h-5 text-xs text-muted">
        {sent
          ? "Your email app should be open with the message ready to send."
          : "Sending opens your email app with the message prefilled."}
      </p>
    </form>
  );
}
