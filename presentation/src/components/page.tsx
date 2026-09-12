import { memo } from "react";
import {
  ASK,
  TEAM,
  folio,
  type Dare,
  type LadderDay,
  type Level,
  type LevelStatus,
  type Point,
  type Slide,
  type Stat,
  type Step,
} from "@/content/deck";
import { Asterisk } from "./asterisk";
import { Chart } from "./charts";
import { Plate } from "./plate";

/**
 * One page of the journal.
 *
 * Same content as the slide, set for a tall page instead of a wide one. The
 * slide carried twenty words and put the rest in the presenter's notes; here
 * the notes are the page — they run under the figure as the body text, which
 * is what fills a portrait page and makes it worth turning.
 *
 * Every size is in `--u`, one percent of the page's own width with a floor so
 * a phone never sets body type at eight pixels. The scale for the `t-*`
 * roles is redefined under `.page` in globals.css.
 */

const u = (n: number) => `calc(${n} * var(--u))`;

export type Side = "recto" | "verso";

export const PageFace = memo(function PageFace({
  slide,
  index,
  total,
  side,
}: {
  slide: Slide;
  index: number;
  total: number;
  side: Side;
}) {
  if (slide.kind === "cover") return <Board slide={slide} />;
  if (slide.kind === "plate") return <PlatePage slide={slide} side={side} />;

  const closing = index === total - 1;
  const bare =
    slide.kind === "statement" && !slide.stats && !slide.body;
  const foot = "foot" in slide ? slide.foot : undefined;

  return (
    <article
      className={`page ${closing ? "page-close" : ""}`}
      data-theme={slide.theme}
      data-side={side}
    >
      <div className="page-scroll">
        <header className="page-run">
          <span className="t-eyebrow">{slide.section}</span>
          <span className="t-eyebrow num">{folio(index)}</span>
        </header>

        <div className={`page-main ${bare ? "page-main--bare" : ""}`}>
          <h2 className={`t-title ${bare ? "t-title--xl" : ""}`}>
            {slide.title}
          </h2>

          <div className="page-body">
            <Body slide={slide} />
          </div>

          {foot && !closing ? (
            <p className="page-foot t-small ink">{foot}</p>
          ) : null}

          {!closing && slide.notes.length ? (
            <div className="page-notes">
              {slide.notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </div>
          ) : null}
        </div>

        {closing ? <Colophon site={foot ?? "stiff.ge"} /> : null}
      </div>
      <div className="page-more" aria-hidden />
    </article>
  );
});

export function BlankPage() {
  return <div className="page page-blank" data-theme="light" />;
}

/* ---------------------------------------------------------------- board -- */

function Board({ slide }: { slide: Extract<Slide, { kind: "cover" }> }) {
  return (
    <article className="page page-board" data-theme={slide.theme} data-side="recto">
      <div className="board">
        <header className="board-head">
          <span className="wordmark">Stiff</span>
          <Asterisk style={{ width: u(4.2), height: u(4.2) }} />
        </header>

        <div className="board-plate">
          <Plate
            id={slide.plate}
            priority
            sizes="(min-width: 900px) 45vw, 92vw"
            className="h-full w-full object-cover grayscale"
          />
        </div>

        <div className="board-foot">
          <p className="t-eyebrow">{slide.eyebrow}</p>
          <h1 className="t-title t-title--xl" style={{ marginTop: u(1.6) }}>
            {slide.title}
          </h1>
          <p className="t-body" style={{ marginTop: u(2.2) }}>
            {slide.sub}
          </p>
        </div>
      </div>
    </article>
  );
}

function Colophon({ site }: { site: string }) {
  return (
    <footer className="colophon ink">
      <span className="wordmark">Stiff</span>
      <Asterisk style={{ width: u(3), height: u(3) }} />
      <span className="t-eyebrow num" style={{ marginLeft: "auto", color: "var(--fg)" }}>
        {site}
      </span>
    </footer>
  );
}

/* ---------------------------------------------------------------- plate -- */

function PlatePage({
  slide,
  side,
}: {
  slide: Extract<Slide, { kind: "plate" }>;
  side: Side;
}) {
  return (
    <article className="page page-plate" data-theme={slide.theme} data-side={side}>
      <Plate
        id={slide.plate}
        sizes="(min-width: 900px) 46vw, 92vw"
        className="absolute inset-0 h-full w-full object-cover grayscale"
      />
      {/* Type sits in an inverted band rather than on the photograph, so its
          contrast is a known quantity instead of whatever the picture does. */}
      <div className="plate-band">
        <p className="t-eyebrow" style={{ color: "var(--bg)", opacity: 0.7 }}>
          {slide.chapter}
        </p>
        <p className="plate-title" style={{ marginTop: u(1.2) }}>
          {slide.title}
        </p>
        <p className="t-body" style={{ color: "var(--bg)", opacity: 0.8, marginTop: u(1.6) }}>
          {slide.caption}
        </p>
      </div>
    </article>
  );
}

/* --------------------------------------------------------------- bodies -- */

function Body({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case "statement":
      return (
        <div className="flex flex-col" style={{ gap: u(3) }}>
          {slide.body ? (
            <div className="flex flex-col" style={{ gap: u(1.2) }}>
              {slide.body.map((line) => (
                <p key={line} className="t-lead">
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          {slide.stats ? <Stats stats={slide.stats} /> : null}
        </div>
      );
    case "points":
      return <Points points={slide.points} />;
    case "stats":
      return <Stats stats={slide.stats} />;
    case "chart":
      return <Chart id={slide.chart} />;
    case "arch":
      return <Arch />;
    case "ladder":
      return <Ladder days={slide.days} />;
    case "steps":
      return <Steps steps={slide.steps} />;
    case "two":
      return (
        <div className="pg-two">
          <Column {...slide.left} />
          <Column {...slide.right} />
        </div>
      );
    case "list":
      return (
        <List
          items={slide.items}
          tail={slide.tail}
          emphasiseLast={slide.emphasiseLast}
        />
      );
    case "dares":
      return <Dares dares={slide.dares} />;
    case "roadmap":
      return <Roadmap levels={slide.levels} />;
    case "ask":
      return <Ask />;
    default:
      return null;
  }
}

/* ---------------------------------------------------------------- stats -- */

function Stats({ stats }: { stats: Stat[] }) {
  const long = stats.some((s) => s.value.length > 4);
  return (
    <div className="pg-stats ink border-t" data-count={stats.length}>
      {stats.map((s) => (
        <div key={s.label}>
          <div className={`t-big num ${long ? "t-big--long" : ""}`}>{s.value}</div>
          <div className="t-eyebrow" style={{ marginTop: u(1.2), color: "var(--fg)" }}>
            {s.label}
          </div>
          {s.note ? (
            <div className="t-small" style={{ marginTop: u(0.5) }}>
              {s.note}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- points -- */

function Points({ points }: { points: Point[] }) {
  return (
    <div className="pg-points" data-count={points.length}>
      {points.map((p) => (
        <div
          key={p.label}
          className={`pg-point ${p.tone ? `tone-${p.tone}` : ""}`}
          style={{ borderColor: p.tone ? "var(--tone)" : "var(--fg)" }}
        >
          <div className="t-eyebrow" style={{ color: p.tone ? "var(--tone)" : "var(--fg)" }}>
            {p.label}
          </div>
          <p className="t-body">{p.text}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ two -- */

function Column({
  label,
  tone,
  items,
}: {
  label: string;
  tone?: Point["tone"];
  items: string[];
}) {
  return (
    <div className={tone ? `tone-${tone}` : ""}>
      <div
        className="t-mid uppercase"
        style={{
          fontFamily: "var(--display)",
          color: tone ? "var(--tone)" : "var(--fg)",
          borderTop: `${u(0.35)} solid ${tone ? "var(--tone)" : "var(--fg)"}`,
          paddingTop: u(1.3),
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <ul className="m-0 list-none p-0" style={{ marginTop: u(1) }}>
        {items.map((it) => (
          <li
            key={it}
            className="t-body hair border-b"
            style={{ padding: `${u(1)} 0`, color: "var(--fg)" }}
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------------- list -- */

function List({
  items,
  tail,
  emphasiseLast,
}: {
  items: string[];
  tail?: string;
  emphasiseLast?: boolean;
}) {
  if (items.length > 8) {
    return (
      <div className="flex flex-col" style={{ gap: u(2.4) }}>
        <ul className="pg-list-grid m-0 list-none p-0">
          {items.map((it) => (
            <li
              key={it}
              className="t-body hair flex items-center border-b"
              style={{ gap: u(1.4), padding: `${u(0.9)} 0`, color: "var(--fg)" }}
            >
              <Asterisk
                className="shrink-0"
                style={{ width: u(1.4), height: u(1.4), color: "var(--accent)" }}
              />
              {it}
            </li>
          ))}
        </ul>
        {tail ? <p className="t-lead">{tail}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: u(2.4) }}>
      <ol className="m-0 list-none p-0">
        {items.map((it, i) => {
          const last = emphasiseLast && i === items.length - 1;
          return (
            <li
              key={it}
              className={`flex items-baseline border-t ${last ? "ink border-b" : "hair"}`}
              style={{ gap: u(2.4), padding: `${u(1)} 0` }}
            >
              <span className="t-eyebrow num" style={{ width: u(4) }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={last ? "t-mid" : "t-body"}
                style={{ color: last ? "var(--fg)" : undefined }}
              >
                {it}
              </span>
            </li>
          );
        })}
      </ol>
      {tail ? <p className="t-body">{tail}</p> : null}
    </div>
  );
}

/* --------------------------------------------------------------- ladder -- */

function Ladder({ days }: { days: LadderDay[] }) {
  return (
    <div className="flex flex-col">
      {days.map((d, i) => (
        <div
          key={d.day}
          className="ink flex items-baseline border-t"
          // Each rung is inset further, so the cut reads as a stair.
          style={{
            marginLeft: u(i * 7),
            gap: u(2.4),
            paddingTop: u(1.2),
            paddingBottom: u(1.4),
          }}
        >
          <span className="t-mid num" style={{ color: "var(--mute)", width: u(4.5) }}>
            {d.day}
          </span>
          <span className="flex-1">
            <span
              className="block uppercase"
              style={{
                fontFamily: "var(--display)",
                fontSize: u(3.2),
                lineHeight: 1,
                letterSpacing: "0.02em",
              }}
            >
              {d.name}
            </span>
            <span className="t-eyebrow block" style={{ marginTop: u(0.8) }}>
              {d.cap} · {d.clock} clock
            </span>
          </span>
          <span className="t-big num" style={{ fontSize: u(6.4) }}>
            {d.count}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- steps -- */

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="pg-steps m-0 list-none p-0">
      {steps.map((s) => (
        <li
          key={s.n}
          className="hair flex flex-col border-t"
          style={{ paddingTop: u(1.3), gap: u(0.9) }}
        >
          <span className="t-eyebrow num" style={{ color: "var(--accent)" }}>
            {s.n}
          </span>
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--display)",
              fontSize: u(2.9),
              lineHeight: 1,
              letterSpacing: "0.02em",
            }}
          >
            {s.title}
          </span>
          <span className="t-body">{s.text}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------------------------------------------------------------- dares -- */

function Dares({ dares }: { dares: Dare[] }) {
  return (
    <div className="pg-dares">
      {dares.map((d) => (
        <div key={d.n} className="pg-dare">
          <div className="flex items-baseline justify-between">
            <span className="t-eyebrow num" style={{ color: "var(--accent)" }}>
              {d.n}
            </span>
            <span className="t-eyebrow">{d.tier}</span>
          </div>
          <div
            className="uppercase"
            style={{
              fontFamily: "var(--display)",
              fontSize: u(3.4),
              lineHeight: 1,
              letterSpacing: "0.02em",
            }}
          >
            {d.title}
          </div>
          <p className="t-body" style={{ color: "var(--fg)", fontSize: u(2.1) }}>
            {d.brief}
          </p>
          <span className="t-eyebrow">{d.kind}</span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- roadmap -- */

const STATUS_LABEL: Record<LevelStatus, string> = {
  built: "Built",
  partial: "In progress",
  next: "Next",
  planned: "Planned",
};

function Roadmap({ levels }: { levels: Level[] }) {
  return (
    <div className="flex flex-col">
      {levels.map((l) => {
        const filled = l.status === "built";
        return (
          <div key={l.n} className="pg-level hair border-b">
            <span className="t-eyebrow num">{l.n}</span>
            <span className="pg-level-name">{l.name}</span>
            <span
              className="t-eyebrow pg-level-status"
              style={{
                borderColor: l.status === "planned" ? "var(--rule)" : "var(--fg)",
                background: filled ? "var(--fg)" : "transparent",
                color: filled
                  ? "var(--bg)"
                  : l.status === "planned"
                    ? "var(--mute)"
                    : "var(--fg)",
              }}
            >
              {STATUS_LABEL[l.status]}
            </span>
            <span className="t-small pg-level-meta" style={{ color: "var(--fg)" }}>
              {l.state}. <em>Gate · {l.gate}.</em>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- arch -- */

function Arch() {
  const sites = [
    { host: "stiff.ge", role: "the shop", state: "live · holding page until launch" },
    { host: "staff.stiff.ge", role: "staff workspace", state: "live" },
    { host: "admin.stiff.ge", role: "admin panel", state: "live" },
    { host: "stiff.co", role: "the game", state: "API built · app next", dashed: true },
  ];
  const services = [
    { name: "Supabase", role: "Postgres, Frankfurt" },
    { name: "Cloudflare R2", role: "all media, zero egress" },
    { name: "Upstash", role: "Redis — second instance safe" },
    { name: "Resend", role: "eight mail templates" },
  ];
  return (
    <div className="flex flex-col" style={{ gap: u(1.6) }}>
      <div className="pg-grid-2">
        {sites.map((s) => (
          <div
            key={s.host}
            style={{
              border: `1px ${s.dashed ? "dashed" : "solid"} var(--fg)`,
              padding: `${u(1.2)} ${u(1.5)}`,
            }}
          >
            <div className="t-body num" style={{ color: "var(--fg)", fontWeight: 600 }}>
              {s.host}
            </div>
            <div className="t-small">{s.role}</div>
            <div className="t-eyebrow" style={{ marginTop: u(0.7) }}>
              {s.state}
            </div>
          </div>
        ))}
      </div>

      <Connector label="one session model · one account for shop and game" />

      <div
        className="flex flex-col"
        style={{
          background: "var(--fg)",
          color: "var(--bg)",
          padding: `${u(1.3)} ${u(1.5)}`,
          gap: u(0.7),
        }}
      >
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--display)",
            fontSize: u(3.2),
            lineHeight: 1,
            letterSpacing: "0.02em",
          }}
        >
          One NestJS API
        </span>
        <span className="t-eyebrow num" style={{ color: "var(--bg)", opacity: 0.75 }}>
          /api · /api/staff · /api/admin · /api/game — on Render
        </span>
      </div>

      <Connector label="every admin write audited · migrations reviewed as code" />

      <div className="pg-grid-2">
        {services.map((s) => (
          <div key={s.name} className="hair border-t" style={{ paddingTop: u(1.1) }}>
            <div className="t-body" style={{ color: "var(--fg)", fontWeight: 600 }}>
              {s.name}
            </div>
            <div className="t-small">{s.role}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div className="flex items-center" style={{ gap: u(1.6), padding: `${u(0.2)} 0` }}>
      <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
      <span className="t-eyebrow" style={{ textAlign: "center" }}>
        {label}
      </span>
      <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ ask -- */

function Blank({ children }: { children: string }) {
  return <span className="blank">{children}</span>;
}

function Ask() {
  return (
    <div className="flex flex-col" style={{ gap: u(3) }}>
      <div className="pg-two">
        <div>
          <p className="t-eyebrow">Raising</p>
          <p className="t-big" style={{ marginTop: u(1), fontSize: u(7) }}>
            {ASK.amount ?? <Blank>amount</Blank>}
          </p>
          <p className="t-body" style={{ marginTop: u(1.4) }}>
            Runway {ASK.runway ?? <Blank>months</Blank>}. Milestone:{" "}
            <strong>{ASK.milestone}</strong>
          </p>
        </div>
        <div>
          <p className="t-eyebrow">Use of funds</p>
          <ul className="m-0 list-none p-0" style={{ marginTop: u(1.2) }}>
            {ASK.useOfFunds.map((f) => (
              <li
                key={f.share}
                className="hair flex flex-col border-b"
                style={{ padding: `${u(0.9)} 0`, gap: u(0.3) }}
              >
                <span className="t-body" style={{ color: "var(--fg)" }}>
                  {f.share}
                </span>
                <span className="t-small">{f.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="ink border-t" style={{ paddingTop: u(1.4) }}>
        <p className="t-eyebrow">Team</p>
        {TEAM.length ? (
          <div className="flex flex-wrap" style={{ gap: `${u(1)} ${u(4)}`, marginTop: u(1) }}>
            {TEAM.map((m) => (
              <span key={m.name} className="t-body">
                <strong>{m.name}</strong> — {m.role}
              </span>
            ))}
          </div>
        ) : (
          <p className="t-body" style={{ marginTop: u(0.6) }}>
            <Blank>names and roles — set TEAM in src/content/deck.ts</Blank>
          </p>
        )}
      </div>
    </div>
  );
}
