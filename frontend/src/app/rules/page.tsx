import type { Metadata } from "next";
import type { SitePolicy } from "@/lib/api";
import { Reveal } from "@/components/motion";
import {
  contentList,
  contentText,
  fetchContent,
  fetchPolicy,
} from "@/lib/content-server";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Rules",
  description:
    "How STIFF works: what we make, how it ships, and what happens if you send it back.",
  alternates: { canonical: "/rules" },
};

// Fallbacks for the API being unreachable. The editable copy lives in the
// backend content registry, which is also what the admin form renders.
const RULES = [
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

const PRACTICAL = [
  {
    title: "Shipping",
    body: "Pickup in Tbilisi is free. City courier is {shippingTbilisi} and the regions are {shippingRegions}.",
  },
  {
    title: "Returns",
    body: "{returnDays} days, unworn, tags on. Refund to the original payment method within 5 working days of arrival back to us.",
  },
  {
    title: "Care",
    body: "Wash cold, inside out. Hang dry — heavy cotton hates the dryer. Iron on the reverse, never on the print.",
  },
];

/**
 * Fills the placeholders in the editable copy from the enforced policy.
 *
 * This page used to promise "14 days" in prose while the returns service read
 * its window from the admin panel, and nothing kept the two in step — change
 * the window and the page went on promising fourteen. Now the sentence keeps
 * its voice and the number comes from the same place the code reads.
 *
 * With no policy (the API being unreachable) the placeholders are left visible
 * rather than filled with a guess. A page inventing a returns window is the
 * exact failure this is here to prevent.
 */
function fillPolicy(body: string, policy: SitePolicy | null): string {
  if (!policy) return body;

  const fee = (method: string) =>
    formatPrice(
      policy.shipping.find((rate) => rate.method === method)?.feeCents ?? 0,
    );

  return body
    .replace(/\{returnDays\}/g, String(policy.returnWindowDays))
    .replace(/\{shippingTbilisi\}/g, fee("tbilisi"))
    .replace(/\{shippingRegions\}/g, fee("regions"))
    .replace(
      /\{freeOver\}/g,
      policy.freeShippingThresholdCents > 0
        ? formatPrice(policy.freeShippingThresholdCents)
        : "—",
    );
}

export default async function RulesPage() {
  const [copy, policy] = await Promise.all([
    fetchContent("rules"),
    fetchPolicy(),
  ]);
  const title = contentText(copy, "title", "House rules");
  const rules = contentList(copy, "items", RULES);
  const practical = contentList(copy, "practical", PRACTICAL);

  return (
    <section className="w-full px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-4xl uppercase tracking-tight sm:text-6xl">{title}</h1>

      <ol className="mt-12 border-t border-subtle">
        {rules.map((rule, i) => (
          <li key={rule.title} className="border-b border-subtle">
            <Reveal className="grid gap-3 py-8 sm:grid-cols-[6rem_1fr] sm:gap-8 sm:py-10">
              <p className="text-[11px] font-medium tracking-[0.2em] text-muted">
                {String(i + 1).padStart(2, "0")}
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

      {practical.length > 0 && (
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
                <p className="mt-3 text-sm leading-6 text-muted">
                  {fillPolicy(item.body, policy)}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      )}

      {policy && <PolicyTable policy={policy} />}
    </section>
  );
}

/**
 * The same numbers again, as a table nobody typed.
 *
 * Every value here is read from the code that enforces it, so this block is
 * the one part of the page that cannot be wrong. It is deliberately plain —
 * the prose above is the brand, this is the receipt.
 */
function PolicyTable({ policy }: { policy: SitePolicy }) {
  const cancellable = policy.cancelStatuses.join(" or ");

  return (
    <div className="mt-20">
      <Reveal>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          What the checkout actually does
        </p>
      </Reveal>
      <Reveal>
        <dl className="mt-6 max-w-2xl border-t border-subtle">
          {policy.shipping.map((rate) => (
            <Row key={rate.method} term={rate.label}>
              {rate.feeCents === 0 ? "Free" : formatPrice(rate.feeCents)}
            </Row>
          ))}
          {policy.freeShippingThresholdCents > 0 && (
            <Row term="Free delivery over">
              {formatPrice(policy.freeShippingThresholdCents)}
            </Row>
          )}
          <Row term="Returns window">
            {policy.returnWindowDays} days from delivery
          </Row>
          {cancellable && (
            <Row term="Cancel by yourself while">{cancellable}</Row>
          )}
        </dl>
      </Reveal>
      <p className="mt-4 max-w-2xl text-xs leading-6 text-muted">
        These are read from the shop&apos;s own settings, not written here — if
        a number changes, this changes with it.
      </p>
    </div>
  );
}

function Row({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-subtle py-3">
      <dt className="text-sm text-muted">{term}</dt>
      <dd className="text-sm tabular-nums">{children}</dd>
    </div>
  );
}
