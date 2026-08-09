"use client";

import { useEffect, useState } from "react";
import { adminApi, contentApi } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { useSession } from "../providers";
import { btnSolidSm, Field, inputCls, labelCls, textareaCls } from "../ui";

export function ContentTab() {
  return (
    <div className="flex flex-col gap-12">
      <ShopSwitch />
      <div className="grid gap-12 lg:grid-cols-2">
        <AboutEditor />
        <ContactInfoEditor />
      </div>
    </div>
  );
}

function ShopSwitch() {
  const { shopEnabled, refreshFeatures } = useSession();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function setShop(enabled: boolean) {
    setBusy(true);
    setNote(null);
    try {
      await adminApi.updateContent("features", { shopEnabled: enabled });
      await refreshFeatures();
      setNote(
        enabled
          ? "Shop is LIVE — clothing and cart are visible again."
          : "Shop is OFF — clothing and cart are hidden site-wide.",
      );
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Shop switch"
      className="border border-subtle p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className={labelCls}>Shop</p>
          <p className="mt-1 text-sm text-muted">
            When OFF, the clothing page, cart and every shop button disappear
            for visitors.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => setShop(true)}
            className={`flex h-9 items-center rounded-[2px] px-4 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
              shopEnabled
                ? "bg-foreground text-background"
                : "border border-subtle text-muted hover:border-foreground hover:text-foreground"
            }`}
          >
            On
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShop(false)}
            className={`flex h-9 items-center rounded-[2px] px-4 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
              !shopEnabled
                ? "bg-foreground text-background"
                : "border border-subtle text-muted hover:border-foreground hover:text-foreground"
            }`}
          >
            Off
          </button>
        </div>
      </div>
      <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted">
        {note}
      </p>
    </section>
  );
}

function AboutEditor() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    contentApi
      .getContent("about")
      .then((content) => {
        const value = content.value as { title?: string; body?: string };
        setTitle(value.title ?? "");
        setBody(value.body ?? "");
      })
      .catch(() => {
        // not set yet — leave blank
      });
  }, []);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setNote(null);
        try {
          await adminApi.updateContent("about", { title, body });
          setNote("About page updated.");
        } catch (err) {
          setNote(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className={labelCls}>About page</p>
      <Field id="about-title" label="Headline">
        <input
          id="about-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nothing extra"
          className={inputCls}
        />
      </Field>
      <Field id="about-body" label="Paragraph">
        <textarea
          id="about-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="The STIFF story…"
          className={textareaCls}
        />
      </Field>
      <button type="submit" disabled={busy} className={`${btnSolidSm} self-start`}>
        {busy ? "Saving…" : "Save"}
      </button>
      <p aria-live="polite" className="min-h-4 text-xs text-muted">
        {note}
      </p>
    </form>
  );
}

function ContactInfoEditor() {
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    contentApi
      .getContent("contact-info")
      .then((content) => {
        const value = content.value as { email?: string; location?: string };
        setEmail(value.email ?? "");
        setLocation(value.location ?? "");
      })
      .catch(() => {
        // not set yet
      });
  }, []);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setNote(null);
        try {
          await adminApi.updateContent("contact-info", { email, location });
          setNote("Contact info updated.");
        } catch (err) {
          setNote(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className={labelCls}>Contact page info</p>
      <Field id="ci-email" label="Public email">
        <input
          id="ci-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="hello@stiff.com"
          className={inputCls}
        />
      </Field>
      <Field id="ci-location" label="Based in">
        <input
          id="ci-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Tbilisi, Georgia"
          className={inputCls}
        />
      </Field>
      <button type="submit" disabled={busy} className={`${btnSolidSm} self-start`}>
        {busy ? "Saving…" : "Save"}
      </button>
      <p aria-live="polite" className="min-h-4 text-xs text-muted">
        {note}
      </p>
    </form>
  );
}
