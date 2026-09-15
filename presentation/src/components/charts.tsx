import { MODEL, seasonBook, type ChartId } from "@/content/deck";

/**
 * Four charts, drawn in HTML.
 *
 * A bar is a rectangle, which a div does natively, and this way every label is
 * real text in the slide's own type scale. House style: no gridlines, no
 * legend boxes, one hairline, the value set large beside its bar, and the
 * solid colour used once per chart to mark the thing the slide is about.
 *
 * Figures are quoted from docs/game/hosting.md. The season projection is
 * computed from `MODEL` and carries a PROJECTED stamp. The war book is a
 * worked example of `settleWarBook` in backend/src/game/rules.ts, computed
 * here by the same arithmetic rather than typed in.
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

/**
 * Revenue against cost, season by season.
 *
 * Nothing here is typed in: every figure is `seasonBook()` over `MODEL`, the
 * same source the unit-economics page quotes, so a changed assumption moves
 * the chart and the headline together.
 */
function RevenueSeasons() {
  const books = MODEL.seasons.map((s) => ({ season: s, book: seasonBook(s) }));
  const MAX = Math.max(...books.map((b) => b.book.revenueUsd));
  const k = (n: number) => `$${(n / 1000).toFixed(1)}k`;
  return (
    <Frame
      caption={`Projected revenue per three-day season, in US dollars at ₾${MODEL.fx} to $1, drawn to scale: coins, pass, shop orders and sponsored dares. Cost is hosting, media and AI — not the team, prizes or garments.`}
    >
      <span
        className="t-eyebrow self-start border"
        style={{
          borderColor: "var(--fg)",
          color: "var(--fg)",
          padding: `${u(0.55)} ${u(1.2)}`,
        }}
      >
        Projected
      </span>
      {books.map(({ season, book }) => (
        <Bar
          key={season.name}
          label={season.name}
          sub={`${season.participants.toLocaleString("en-US")} people · cost ${k(book.costUsd)} · net ${k(book.contributionUsd)}`}
          value={k(book.revenueUsd)}
          pct={(book.revenueUsd / MAX) * 100}
          solid={book === books[books.length - 1].book}
        />
      ))}
    </Frame>
  );
}

/**
 * The book on one clan war, settled.
 *
 * Parimutuel: the winners split the losers' pool in proportion to their
 * stakes, after the house takes `RAKE`% of the losing pool. The shares here
 * divide evenly, so the largest-remainder pass in the real function has
 * nothing to hand out; the identity it guarantees is shown on the chart.
 */
function WarBook() {
  const RAKE = 10;
  const bets = [
    { who: "Bettor A", side: "Wolves", won: true, stake: 200 },
    { who: "Bettor B", side: "Wolves", won: true, stake: 100 },
    { who: "Bettor C", side: "Crows", won: false, stake: 60 },
    { who: "Bettor D", side: "Crows", won: false, stake: 40 },
  ];
  const winPool = bets.filter((b) => b.won).reduce((n, b) => n + b.stake, 0);
  const losePool = bets.filter((b) => !b.won).reduce((n, b) => n + b.stake, 0);
  const rake = Math.floor((losePool * RAKE) / 100);
  const distributable = losePool - rake;
  const rows = bets.map((b) => ({
    ...b,
    payout: b.won
      ? b.stake + Math.floor((b.stake * distributable) / winPool)
      : 0,
  }));
  const paid = rows.reduce((n, r) => n + r.payout, 0);
  const MAX = Math.max(...rows.map((r) => Math.max(r.stake, r.payout)));

  return (
    <Frame
      caption={`Wolves beat Crows. Crows' ${losePool} coins are the losing pool; the house keeps ${rake} (${RAKE}%), and ${distributable} is split ${bets[0].stake}:${bets[1].stake} between the Wolves' backers. Paid ${paid} + rake ${rake} = staked ${winPool + losePool}, exactly — the property the server's test holds over 400 random books.`}
    >
      {rows.map((r) => (
        <div key={r.who} className="flex flex-col" style={{ gap: u(0.4) }}>
          <Bar
            label={r.who}
            sub={`backed ${r.side} · staked ${r.stake}`}
            value={r.won ? `${r.payout}` : "0"}
            pct={(r.payout / MAX) * 100}
            solid={r.won}
          />
        </div>
      ))}
      <div className="flex" style={{ gap: u(4), marginTop: u(0.6) }}>
        <span className="t-eyebrow flex items-center" style={{ gap: u(1), color: "var(--fg)" }}>
          <span
            className="inline-block"
            style={{ width: u(3), height: u(1.3), background: "var(--bar)" }}
          />
          Coins back: stake plus share
        </span>
        <span className="t-eyebrow">House rake: {rake} coins, never money</span>
      </div>
    </Frame>
  );
}

const CHARTS: Record<ChartId, () => React.ReactElement> = {
  "war-book": WarBook,
  "monthly-bill": MonthlyBill,
  "r2-vs-aws": R2VsAws,
  "revenue-seasons": RevenueSeasons,
};

export function Chart({ id }: { id: ChartId }) {
  const C = CHARTS[id];
  return <C />;
}
