import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { Reveal } from "@/components/motion";
import { SocialLinks } from "@/components/social-links";

export const metadata: Metadata = { title: "Contact — STIFF" };

export default function ContactPage() {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-16">
      <Reveal>
        <h1 className="text-5xl uppercase leading-[0.9] tracking-tight sm:text-7xl">
          Talk
          <br />
          to us
        </h1>
        <p className="mt-6 max-w-sm text-sm leading-7 text-muted">
          Collabs, stockists, sizing, anything. We read everything.
        </p>
        <div className="mt-10 flex flex-col gap-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              Email
            </p>
            <a
              href="mailto:hello@stiff.com"
              className="mt-1 inline-block rounded-[2px] text-sm text-foreground underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
            >
              hello@stiff.com
            </a>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              Based in
            </p>
            <p className="mt-1 text-sm">Tbilisi, Georgia</p>
          </div>
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              Social
            </p>
            <SocialLinks />
          </div>
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <ContactForm />
      </Reveal>
    </section>
  );
}
