import type { Metadata } from "next";
import { Reveal } from "@/components/motion";

export const metadata: Metadata = { title: "Rules — STIFF" };

const rules = [
  {
    title: "Wear it hard",
    body: "These pieces are made to be lived in, not archived. Scuffs are proof of use.",
  },
  {
    title: "Buy less, wear more",
    body: "One heavy tee beats five thin ones. We'd rather sell you fewer things you actually wear.",
  },
  {
    title: "The asterisk means essential",
    body: "If a detail doesn't earn its place, it gets cut. What's left is marked with *.",
  },
  {
    title: "No fast fashion",
    body: "Small runs, slow drops. When a drop sells out, it's gone — we move forward, not backward.",
  },
  {
    title: "Come as you are",
    body: "No gatekeeping. If you wear it, it's yours. Style it wrong on purpose.",
  },
];

const practical = [
  {
    title: "Shipping",
    body: "Georgia: 1–3 working days. Worldwide: 5–10 working days, tracked. Exact rates show at checkout when the shop opens.",
  },
  {
    title: "Returns",
    body: "14 days, unworn, tags on. Refund to the original payment method within 5 working days of arrival back to us.",
  },
  {
    title: "Care",
    body: "Wash cold, inside out. Hang dry — heavy cotton hates the dryer. Iron on the reverse, never on the print.",
  },
];

export default function RulesPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">
        House rules
      </h1>

      <ol className="mt-12 border-t border-subtle">
        {rules.map((rule, i) => (
          <li key={rule.title} className="border-b border-subtle">
            <Reveal className="grid gap-3 py-8 sm:grid-cols-[6rem_1fr] sm:gap-8 sm:py-10">
              <p className="text-[11px] font-medium tracking-[0.2em] text-muted">
                0{i + 1}
              </p>
              <div>
                <h2 className="text-3xl uppercase leading-none tracking-tight sm:text-5xl">
                  {rule.title}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
                  {rule.body}
                </p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>

      <div className="mt-20">
        <Reveal>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            The practical part
          </p>
        </Reveal>
        <div className="mt-6 grid gap-10 sm:grid-cols-3">
          {practical.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <h2 className="text-xl uppercase tracking-tight sm:text-2xl">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
