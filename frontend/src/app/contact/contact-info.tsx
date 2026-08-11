"use client";

import { contentApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { SocialLinks } from "@/components/social-links";

const FALLBACK = { email: "stiffenter@gmail.com", location: "Tbilisi, Georgia" };

/** Contact details, editable from the admin panel (contact-info content). */
export function ContactInfo() {
  const { data } = useAsync(() => contentApi.getContent("contact-info"), []);
  const value = data?.value as
    | { email?: string; location?: string }
    | undefined;
  const email = value?.email || FALLBACK.email;
  const location = value?.location || FALLBACK.location;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          Email
        </p>
        <a
          href={`mailto:${email}`}
          className="mt-1 inline-block rounded-[2px] text-sm text-foreground underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
        >
          {email}
        </a>
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          Based in
        </p>
        <p className="mt-1 text-sm">{location}</p>
      </div>
      <div>
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          Social
        </p>
        <SocialLinks />
      </div>
    </div>
  );
}
