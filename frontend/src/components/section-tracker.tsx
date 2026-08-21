"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/track-event";

/**
 * Reports that a section came into view, once per visit.
 *
 * Wraps a section rather than sitting inside it, so the thing being observed
 * is the thing being measured and nothing has to be kept in step by hand.
 *
 * The threshold is deliberately low. "Did they reach this part of the page" is
 * the question, not "did they read it" — a section that is half on screen has
 * been reached, and requiring it to be fully visible would never fire for the
 * ones taller than the viewport.
 */
export function SectionTracker({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const node = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /**
     * The child, not the wrapper.
     *
     * The wrapper is `display: contents` so it adds no box to the layout — and
     * an element with no box has no intersection to observe, so watching it
     * directly would silently never fire. The child is the real section.
     */
    const element = node.current?.firstElementChild;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        trackEvent("section_view", label);
        // Once. A visitor who scrolls back up has not reached it twice, and
        // counting it that way would put the middle of the page above the top.
        observer.disconnect();
      },
      { threshold: 0.15 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [label]);

  // `display: contents` so the wrapper adds no box of its own — the sections
  // below rely on their own borders and spacing meeting exactly.
  return (
    <div ref={node} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
