import type { Metadata } from "next";
import Link from "next/link";
import { AsteriskMark } from "@/components/asterisk-mark";
import { Magnetic, Reveal } from "@/components/motion";
import { AboutIntro } from "./about-intro";

export const metadata: Metadata = {
  title: "About",
  description:
    "STIFF is a clothing brand built on one idea: strip everything back until only the essential is left, then make that essential unignorable. Designed and worn in Tbilisi first.",
  alternates: { canonical: "/about" },
};

const values = [
  {
    title: "Essential",
    body: "Every piece earns its place. If it doesn't add anything, it doesn't ship — a small line, cut hard, made to be worn until it falls apart.",
  },
  {
    title: "Heavy",
    body: "Weight is a feature. Thick cotton, dense embroidery, hardware that closes with a click. Clothing you can feel on the hanger.",
  },
  {
    title: "Ours",
    body: "Designed and worn in Tbilisi first. The asterisk is the spark — the footnote that became the headline.",
  },
];

function Separator() {
  return (
    <div aria-hidden="true" className="flex justify-center py-14">
      <AsteriskMark className="spin-on-hover size-6 text-muted" />
    </div>
  );
}

export default function AboutPage() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <AboutIntro />

      {values.map((value) => (
        <div key={value.title}>
          <Separator />
          <Reveal>
            <h2 className="text-center text-3xl uppercase tracking-tight sm:text-4xl">
              {value.title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-7 text-muted">
              {value.body}
            </p>
          </Reveal>
        </div>
      ))}

      <Separator />
      <Reveal className="flex justify-center">
        <Magnetic>
          <Link
            href="/clothing"
            className="flex h-12 items-center rounded-[2px] bg-foreground px-8 text-xs font-bold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            See the first drop
          </Link>
        </Magnetic>
      </Reveal>
    </section>
  );
}
