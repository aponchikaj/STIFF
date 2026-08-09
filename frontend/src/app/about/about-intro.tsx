"use client";

import { contentApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { Reveal } from "@/components/motion";

const FALLBACK = {
  title: "Nothing extra",
  body: "STIFF is a clothing brand built on one idea: strip everything back until only the essential is left, then make that essential unignorable.",
};

/** Headline + intro paragraph, editable from the admin panel. */
export function AboutIntro() {
  const { data } = useAsync(() => contentApi.getContent("about"), []);

  const value = data?.value as { title?: string; body?: string } | undefined;
  const title = value?.title || FALLBACK.title;
  const body = value?.body || FALLBACK.body;

  return (
    <Reveal>
      <h1 className="text-center text-4xl uppercase tracking-tight sm:text-6xl">
        {title}
      </h1>
      <p className="mx-auto mt-6 max-w-xl whitespace-pre-line text-center text-sm leading-7 text-muted">
        {body}
      </p>
    </Reveal>
  );
}
