import type { ChartId } from "@/content/deck";

/**
 * Three charts, drawn in HTML.
 *
 * A bar is a rectangle, which a div does natively, and this way every label is
 * real text in the slide's own type scale. House style: no gridlines, no
 * legend boxes, one hairline, the value set large beside its bar, and the
 * solid colour used once per chart to mark the thing the slide is about.
 *
 * Figures are quoted from docs/game/hosting.md. The revenue split is the one
 * projection in the deck and carries a PROJECTED stamp.
 */

const u = (n: number) => `calc(${n} * var(--u))`;

function Frame({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <figure className="m-0 flex h-full flex-col justify-center">
      <div className="flex flex-col" style={{ gap: u(1.3) }}>
        {children}
      </div>
      {caption ? (
        <figcaption
          className="t-small hair border-t"
          style={{ marginTop: u(1.8), paddingTop: u(1), fontSize: u(1.45) }}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Bar({
  label,
  sub,
  value,
  pct,
  solid = false,
}: {
  label: string;
  sub?: string;
  value: string;
  pct: number;
  solid?: boolean;
}) {
  return (
    <div className="flex items-center" style={{ gap: u(2.4) }}>
      <div className="w-[24%] shrink-0">
        {label ? (
          <div className="t-eyebrow" style={{ color: "var(--fg)" }}>
            {label}
          </div>
        ) : null}
        {sub ? (
          <div className="t-small" style={{ marginTop: u(0.3) }}>
            {sub}
          </div>
        ) : null}
      </div>
      <div className="relative flex-1" style={{ height: u(2.8) }}>
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${pct}%`,
            // A percentage floor is not enough: $1 against $344 is 0.3% of the
            // track, which rounds to nothing. The pixel floor keeps the bar
            // visible, which is the whole point of the chart.
            minWidth: "4px",
            background: solid ? "var(--bar)" : "var(--bar-soft)",
          }}
        />
      </div>
      <div
        className="t-mid num w-[14%] shrink-0 text-right"
        style={{ color: solid ? "var(--fg)" : "var(--mute)" }}
      >
        {value}
      </div>
    </div>
  );
}

function MonthlyBill() {
  const CEILING = 750;
  const rows = [
    { label: "Steady", sub: "shop live, no season", value: 131 },
    { label: "Season", sub: "1,000 players, medium viewing", value: 267 },
    { label: "Season + AI", sub: "verification cascade running", value: 520 },
  ];
  return (
    <Frame caption="Monthly, in US dollars. Ceiling is self-imposed. Headroom in the worst case is about $230.">
      <div className="flex items-center" style={{ gap: u(2.4) }}>
        <div className="w-[24%] shrink-0" />
        <div className="relative flex-1" style={{ height: u(2.4) }}>
          <div
            className="absolute right-0 left-0 top-1/2 border-t border-dashed"
            style={{ borderColor: "var(--fg)" }}
          />
          <div
            className="t-eyebrow absolute right-0"
            style={{
              top: u(-0.2),
              background: "var(--bg)",
              paddingLeft: u(1),
              color: "var(--fg)",
            }}
          >
            $750 ceiling
          </div>
        </div>
        <div className="w-[14%] shrink-0" />
      </div>
      {rows.map((r) => (
        <Bar
          key={r.label}
          label={r.label}
          sub={r.sub}
          value={`$${r.value}`}
          pct={(r.value / CEILING) * 100}
          solid={r.value === 267}
        />
      ))}
    </Frame>
  );
}

function R2VsAws() {
  const MAX = 344;
  const rows = [
    { label: "Light", sub: "268 GB served", aws: 24, r2: 1 },
    { label: "Medium", sub: "805 GB served", aws: 70, r2: 1 },
    { label: "Viral", sub: "4 TB served", aws: 344, r2: 2 },
  ];
  return (
    <Frame caption="One 1,000-player season, in US dollars, drawn to scale. Storage and requests are cents on both; the whole difference is egress.">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col" style={{ gap: u(0.5) }}>
          <Bar
            label={r.label}
            sub={r.sub}
            value={`$${r.aws}`}
            pct={(r.aws / MAX) * 100}
          />
          <Bar label="" value={`$${r.r2}`} pct={(r.r2 / MAX) * 100} solid />
        </div>
      ))}
      <div className="flex" style={{ gap: u(4), marginTop: u(0.6) }}>
        <span className="t-eyebrow flex items-center" style={{ gap: u(1) }}>
          <span
            className="inline-block"
            style={{ width: u(3), height: u(1.3), background: "var(--bar-soft)" }}
          />
          AWS S3 + CloudFront
        </span>
        <span className="t-eyebrow flex items-center" style={{ gap: u(1), color: "var(--fg)" }}>
          <span
            className="inline-block"
            style={{ width: u(3), height: u(1.3), background: "var(--bar)" }}
          />
          Cloudflare R2
        </span>
      </div>
    </Frame>
  );
}

function RevenueSplit() {
  const parts = [
    { label: "Coin bundles", pct: 40, note: "by card, via TBC and BOG" },
    { label: "Season pass", pct: 30, note: "sold before the season opens" },
    { label: "Sponsorship", pct: 20, note: "not before season two" },
    { label: "Shop", pct: 10, note: "the number that matters" },
  ];
  return (
    <Frame caption="Planning assumptions, not measurements — season one has not run. Sponsorship is last because it is the only source that needs an audience you already have.">
      <div className="flex items-center" style={{ gap: u(1.5) }}>
        <span
          className="t-eyebrow border"
          style={{
            borderColor: "var(--fg)",
            color: "var(--fg)",
            padding: `${u(0.55)} ${u(1.2)}`,
          }}
        >
          Projected
        </span>
        <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
      </div>
      <div className="flex w-full overflow-hidden" style={{ height: u(6) }}>
        {parts.map((p, i) => (
          <div
            key={p.label}
            style={{
              width: `${p.pct}%`,
              background: i === 3 ? "var(--bar)" : "var(--bar-soft)",
              opacity: i === 3 ? 1 : 1 - i * 0.24,
            }}
          />
        ))}
      </div>
      <div className="flex flex-col" style={{ gap: u(0.9) }}>
        {parts.map((p, i) => (
          <div
            key={p.label}
            className="hair flex items-baseline border-b"
            style={{ gap: u(2.4), paddingBottom: u(0.9) }}
          >
            <span className="t-mid num w-[12%] shrink-0">{p.pct}%</span>
            <span
              className="t-body flex-1"
              style={{ color: "var(--fg)", fontWeight: i === 3 ? 600 : 400 }}
            >
              {p.label}
            </span>
            <span className="t-small">{p.note}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

const CHARTS: Record<ChartId, () => React.ReactElement> = {
  "monthly-bill": MonthlyBill,
  "r2-vs-aws": R2VsAws,
  "revenue-split": RevenueSplit,
};

export function Chart({ id }: { id: ChartId }) {
  const C = CHARTS[id];
  return <C />;
}
