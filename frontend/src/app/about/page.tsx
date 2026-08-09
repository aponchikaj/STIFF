import type { Metadata } from "next";
import { AsteriskMark } from "@/components/asterisk-mark";
import { Reveal } from "@/components/motion";

export const metadata: Metadata = { title: "About — STIFF" };

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
      <Reveal>
        <h1 className="text-center text-4xl uppercase tracking-tight sm:text-6xl">
          Nothing extra
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-center text-sm leading-7 text-muted">
          STIFF is a clothing brand built on one idea: strip everything back
          until only the essential is left, then make that essential
          unignorable.
        </p>
      </Reveal>

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
    </section>
  );
}
