import type { CreditRole, GalleryCredit } from "@/lib/api";

/**
 * Who made the photograph.
 *
 * The cheapest thing on this page and the one with the best return: every
 * person named here has a reason to share the page they are named on, and a
 * shoot nobody is credited for is one nobody reposts.
 */

/** Display names for the stored roles, which are slugs. */
const ROLE_LABELS: Record<CreditRole, string> = {
  photographer: "Photography",
  model: "Model",
  stylist: "Styling",
  makeup: "Make-up",
  hair: "Hair",
  art_direction: "Art direction",
  set_design: "Set design",
  retouch: "Retouching",
  assistant: "Assistant",
  location: "Location",
};

/**
 * Reading order, so a credit list is always in the same order regardless of
 * the order the admin happened to type it in.
 */
const ROLE_ORDER: CreditRole[] = [
  "photographer",
  "model",
  "stylist",
  "makeup",
  "hair",
  "art_direction",
  "set_design",
  "retouch",
  "assistant",
  "location",
];

function rank(role: CreditRole): number {
  const index = ROLE_ORDER.indexOf(role);
  return index === -1 ? ROLE_ORDER.length : index;
}

/** The one place a stored handle becomes a link, so the @ lives in one file. */
function creditHref(credit: GalleryCredit): string | null {
  if (credit.instagram) {
    return `https://www.instagram.com/${encodeURIComponent(credit.instagram)}/`;
  }
  return credit.url;
}

export function GalleryCredits({
  credits,
  heading = "Credits",
  className = "",
}: {
  credits: GalleryCredit[];
  heading?: string;
  className?: string;
}) {
  if (credits.length === 0) return null;

  // Several people can hold one role — two models, three assistants — so the
  // role is the row and the names are the value, rather than one row each.
  const byRole = new Map<CreditRole, GalleryCredit[]>();
  for (const credit of credits) {
    byRole.set(credit.role, [...(byRole.get(credit.role) ?? []), credit]);
  }
  const rows = [...byRole.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));

  return (
    <section className={className}>
      <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
        {heading}
      </h2>
      <dl className="mt-4 flex flex-col gap-2">
        {rows.map(([role, people]) => (
          <div
            key={role}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-subtle pb-2 last:border-0"
          >
            <dt className="w-32 shrink-0 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              {ROLE_LABELS[role] ?? role}
            </dt>
            <dd className="flex flex-wrap gap-x-3 text-sm text-foreground">
              {people.map((credit) => {
                const href = creditHref(credit);
                return href ? (
                  <a
                    key={credit.id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-[2px] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                  >
                    {credit.name}
                    {credit.instagram && (
                      <span className="text-muted"> @{credit.instagram}</span>
                    )}
                  </a>
                ) : (
                  <span key={credit.id}>{credit.name}</span>
                );
              })}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The people, as schema.org sees them.
 *
 * `ImageObject.creator` is what an image search reads to attribute a
 * photograph, and `sameAs` is how it links a name to a profile it already
 * knows about.
 */
export function creditsToSchema(credits: GalleryCredit[]) {
  const person = (credit: GalleryCredit) => ({
    "@type": "Person",
    name: credit.name,
    ...(creditHref(credit) ? { sameAs: creditHref(credit) } : {}),
  });

  const photographers = credits.filter((c) => c.role === "photographer");
  const rest = credits.filter((c) => c.role !== "photographer");

  return {
    ...(photographers.length > 0
      ? { creator: photographers.map(person) }
      : {}),
    ...(rest.length > 0 ? { contributor: rest.map(person) } : {}),
  };
}
