import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { Reveal } from "@/components/motion";
import { ContactInfo } from "./contact-info";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to STIFF — collabs, stockists, sizing, anything. Based in Tbilisi, Georgia.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <section className="flex w-full flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="grid w-full max-w-4xl gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <h1 className="text-5xl uppercase leading-[0.9] tracking-tight sm:text-7xl">
            Talk
            <br />
            to us
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-muted">
            Collabs, stockists, sizing, anything. We read everything.
          </p>
          <div className="mt-10">
            <ContactInfo />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <ContactForm />
        </Reveal>
      </div>
    </section>
  );
}
