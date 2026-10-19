"use client";

import { memo, useState } from "react";
import {
  CONTACT,
  MANUAL,
  folio,
  type Bar,
  type Check,
  type Page,
  type Row,
  type Side as SideColumn,
  type Stat,
  type Step,
  type Tier,
} from "@/content/manual";

/**
 * One page of the manual.
 *
 * Every page has the same frame — a running head like the game's HUD (the
 * stage on the outside edge, the page number on the inside), a lit title,
 * a lede, the page's one figure, and the reading text under it. The book is
 * read alone as often as it is presented, so the reading text is the page,
 * not a speaker's note.
 *
 * Sizes are in `--u`, one percent of the page's own width (globals.css).
 */

export type FaceSide = "recto" | "verso";

export const PageFace = memo(function PageFace({
  page,
  index,
  side,
}: {
  page: Page;
  index: number;
  side: FaceSide;
}) {
  if (page.kind === "cover") return <Cover page={page} />;

  return (
    <article className="page" data-side={side}>
      <div className="page-scroll">
        <header className="run">
          <span className="eyebrow">▶ {page.stage}</span>
          <span className="eyebrow is-faint">
            P.{folio(index)} / {folio(MANUAL.length - 1)}
          </span>
        </header>

        <div className="page-main">
          {page.kind === "continue" ? (
            <Continue page={page} />
          ) : (
            <>
              <h2 className="phosphor title" data-text={page.title}>
                {page.title}
              </h2>
              {page.lede ? <p className="lede">{page.lede}</p> : null}
              <div className="figure">
                <Figure page={page} />
              </div>
              {page.body?.length ? (
                <div className="prose">
                  {page.body.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="page-end">
          <span className="eyebrow is-faint">STIFF · Operator&apos;s manual</span>
          {page.stamp ? <span className="stamp">{page.stamp}</span> : null}
        </footer>
      </div>
    </article>
  );
});

export function BlankPage() {
  return <div className="page page-blank" />;
}

/* ---------------------------------------------------------------- cover -- */

function Cover({ page }: { page: Extract<Page, { kind: "cover" }> }) {
  return (
    <article className="page" data-side="recto">
      <div className="cover">
        <div className="cover-top">
          <span className="eyebrow">{page.top[0]}</span>
          <span className="eyebrow is-faint">{page.top[1]}</span>
        </div>

        <div className="cover-center">
          <h1 className="phosphor cover-mark" data-text="STIFF">
            STIFF
          </h1>
          <p className="px cover-kind tone-glow">{page.title}</p>
          <p className="px cover-edition tone-coin">{page.edition}</p>
          <p className="cover-sub">{page.sub}</p>
          <p className="px cover-start">Press start ▶</p>
        </div>

        <div className="cover-bottom">
          {page.bottom.map((t) => (
            <span key={t} className="eyebrow is-faint">
              {t}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------- figures -- */

function Figure({ page }: { page: Page }) {
  switch (page.kind) {
    case "stats":
      return <Stats stats={page.stats} />;
    case "steps":
      return <Steps steps={page.steps} />;
    case "sides":
      return (
        <div className="sides">
          <SideCol side={page.left} />
          <SideCol side={page.right} />
        </div>
      );
    case "big":
      return (
        <div className="big">
          <p className="phosphor big-value" data-text={page.value}>
            {page.value}
          </p>
          <p className="px big-label tone-glow">{page.label}</p>
          <p className="big-sum">
            {page.sum.map((part, i) =>
              i % 2 === 0 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>,
            )}
          </p>
        </div>
      );
    case "table":
      return <Table columns={page.columns} rows={page.rows} widths={page.widths} />;
    case "tiers":
      return <Tiers tiers={page.tiers} />;
    case "checks":
      return <Checks checks={page.checks} />;
    case "bars":
      return <Bars bars={page.bars} />;
    case "status":
      return (
        <div className="status">
          {page.rows.map((r) => (
            <div key={r.label} className="status-row">
              <span className={`px status-chip ${r.live ? "is-live" : "is-next"}`}>
                {r.live ? "Live" : "Next"}
              </span>
              <span className="px status-label">{r.label}</span>
              <span className="status-text">{r.text}</span>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

function Stats({ stats }: { stats: Stat[] }) {
  // One size for the whole row: a long value set small beside a short one
  // set large reads as a ranking, and a four-character value at full size
  // runs into its neighbour.
  const long = stats.some((s) => s.value.length > 3);
  return (
    <div className="stats" style={{ "--n": stats.length } as React.CSSProperties}>
      {stats.map((s) => (
        <div key={s.label}>
          <div className={`stat-value ${long ? "is-long" : ""}`}>{s.value}</div>
          <div className="eyebrow stat-label">{s.label}</div>
          {s.note ? <div className="stat-note">{s.note}</div> : null}
        </div>
      ))}
    </div>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="steps">
      {steps.map((s) => (
        <li key={s.key} className="step">
          <span className="px step-key">{s.key}</span>
          <span className="step-text">{s.text}</span>
        </li>
      ))}
    </ol>
  );
}

function SideCol({ side }: { side: SideColumn }) {
  const heart = side.tone === "heart";
  return (
    <div className={`side ${heart ? "is-heart" : "is-glow"}`}>
      <p className={`side-name ${heart ? "tone-heart" : "tone-glow"}`} style={{ fontFamily: "var(--display)" }}>
        {side.name.toUpperCase()}
      </p>
      <p className="eyebrow side-tag" style={heart ? { color: "var(--heart)", textShadow: "none" } : undefined}>
        {side.tag}
      </p>
      <ul>
        {side.items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function Table({
  columns,
  rows,
  widths,
}: {
  columns: string[];
  rows: Row[];
  widths: string;
}) {
  return (
    <div className="table" style={{ "--cols": widths } as React.CSSProperties}>
      <div className="table-row table-head">
        {columns.map((c) => (
          <span key={c} className="eyebrow is-faint">
            {c}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div
          key={r.cells[0]}
          className={`table-row ${r.tone === "strong" ? "is-strong" : ""} ${r.tone === "coin" ? "is-coin" : ""} ${r.tone === "off" ? "is-off" : ""}`}
        >
          {r.cells.map((c, i) => (
            <span key={i} className={i === 0 ? "px table-key" : "table-val"}>
              {c}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Tiers({ tiers }: { tiers: Tier[] }) {
  return (
    <div className="tiers">
      {tiers.map((t) => (
        // Parent blooms, child notches: a glow beside a clip-path is clipped.
        <div key={t.name} className={`tier-bloom ${t.headline ? "is-coin" : ""}`}>
          <div className="tier-frame">
            <div className="tier">
              <span className="px tier-name">{t.name}</span>
              <span className="px tier-price">{t.price}</span>
              <span className="tier-text">{t.text}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Checks({ checks }: { checks: Check[] }) {
  return (
    <ul className="checks">
      {checks.map((c) => (
        <li key={c.label} className="check">
          <span className="px check-mark">■</span>
          <span className="px check-label">{c.label}</span>
          <span className="check-text">{c.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Cell pitch of the bar track, in `--u`. Widths snap to whole cells. */
const CELLS = 40;

function Bars({ bars }: { bars: Bar[] }) {
  const max = Math.max(...bars.flatMap((b) => [b.value, b.cost ?? 0]));
  const cells = (v: number) => Math.max(1, Math.round((v / max) * CELLS));
  return (
    <div className="bars">
      {bars.map((b) => (
        <div key={b.name}>
          <div className="bar-head">
            <span className="px bar-name">{b.name}</span>
            <span className="px bar-value">{b.display}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(cells(b.value) / CELLS) * 100}%` }} />
          </div>
          {b.cost !== undefined ? (
            <div className="bar-track" style={{ height: "calc(1.2 * var(--u))", marginTop: "calc(0.5 * var(--u))" }}>
              <div className="bar-fill is-cost" style={{ width: `${(cells(b.cost) / CELLS) * 100}%` }} />
            </div>
          ) : null}
          <p className="bar-note">{b.note}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ continue -- */

function Continue({ page }: { page: Extract<Page, { kind: "continue" }> }) {
  // The cabinet's own last screen. YES is the call to action; the caret
  // follows the pointer and focus like the game's CabinetMenu.
  const [on, setOn] = useState<"yes" | "no">("yes");
  const mail = CONTACT.email
    ? `mailto:${CONTACT.email}?subject=${encodeURIComponent("STIFF — sponsoring Season 01")}`
    : undefined;

  return (
    <div className="cont">
      <h2 className="phosphor cont-title" data-text={page.title}>
        {page.title}
      </h2>
      <p className="px cont-q">{page.question}</p>
      <nav className="cont-menu" aria-label={page.question}>
        <a
          className={`px cont-opt ${on === "yes" ? "is-on" : ""}`}
          href={mail ?? `https://${CONTACT.site}`}
          onMouseEnter={() => setOn("yes")}
          onFocus={() => setOn("yes")}
          data-book-control
        >
          Yes
        </a>
        <a
          className={`px cont-opt ${on === "no" ? "is-on" : ""}`}
          href="#/1"
          onMouseEnter={() => setOn("no")}
          onFocus={() => setOn("no")}
          data-book-control
        >
          No
        </a>
      </nav>
      <div className="cont-terms prose">
        {page.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p>
          <strong>{CONTACT.email ?? "Contact: add an email in src/content/manual.ts"}</strong>
          {" · "}
          {CONTACT.site}
        </p>
      </div>
    </div>
  );
}
