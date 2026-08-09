"use client";

import { contentApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

const FALLBACK = {
  title: "Nothing extra",
  body: "STIFF is a clothing brand built on one idea: strip everything back until only the essential is left, then make that essential unignorable.",
};

/** Admin-editable about excerpt for the home page. */
export function AboutTeaser() {
  const { data } = useAsync(() => contentApi.getContent("about"), []);
  const value = data?.value as { title?: string; body?: string } | undefined;
  const title = value?.title || FALLBACK.title;
  const body = value?.body || FALLBACK.body;
  const excerpt = body.length > 220 ? `${body.slice(0, 220).trimEnd()}…` : body;

  return (
    <>
      <h2 className="text-4xl uppercase leading-none tracking-tight sm:text-6xl">
        {title}
      </h2>
      <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-muted">
        {excerpt}
      </p>
    </>
  );
}
