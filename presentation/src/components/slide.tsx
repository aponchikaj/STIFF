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
 * One slide, any kind.
 *
 * Every size is written in `--u` (one percent of the slide's width), so the
 * layout is the same object on a laptop and on a projector. The running head,
 * the title position and the progress hairline sit in the same place on every
 * slide — the grid is the one thing an audience should never have to relearn.
 */

const u = (n: number) => `calc(${n} * var(--u))`;

export function SlideView({
  slide,
  index,
  total,
}: {
  slide: Slide;
  index: number;
  total: number;
}) {
  const pct = ((index + 1) / total) * 100;

  if (slide.kind === "plate") {
    return (
      <article className="slide p-0!" data-theme={slide.theme}>
        <PlateSlide slide={slide} />
        <Progress pct={pct} />
      </article>
    );
  }

  if (slide.kind === "cover") {
    return (
      <article className="slide" data-theme={slide.theme}>
        <Cover slide={slide} />
        <Progress pct={pct} />
      </article>
    );
  }

  return (
    <article className="slide" data-theme={slide.theme}>
      <div className="running">
        <span className="t-eyebrow">{slide.section}</span>
        <span className="t-eyebrow num">
          {folio(index)} / {total}
        </span>
      </div>

      <header className="slide-head" style={{ marginTop: u(2.2) }}>
        <h2
          className={`t-title ${
            slide.kind === "statement" && !slide.stats && !slide.body
              ? "t-title--xl"
              : ""
          }`}
        >
          {slide.title}
        </h2>
      </header>

      <div
        className={`slide-body ${
          slide.kind === "statement" && slide.body && !slide.stats
            ? "slide-body--end"
            : ""
        }`}
        style={{ marginTop: u(3.2) }}
      >
        <Body slide={slide} />
      </div>

      <Foot slide={slide} />
      <Progress pct={pct} />
    </article>
  );
}

function Progress({ pct }: { pct: number }) {
  return (
    <div className="progress" aria-hidden>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

function Foot({ slide }: { slide: Slide }) {
  const text = "foot" in slide ? slide.foot : undefined;
  if (!text) return null;
  return (
    <footer
      className="slide-foot t-small ink border-t"
      style={{ marginTop: u(2.4), paddingTop: u(1.2), maxWidth: "80%" }}
    >
      {text}
    </footer>
  );
}

/* --------------------------------------------------------------- bodies -- */

function Body({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case "statement":
      return (
        <div className="flex flex-col" style={{ gap: u(3) }}>
          {slide.body ? (
            <div className="flex flex-col" style={{ gap: u(1.2), maxWidth: "78%" }}>
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
        <div className="cols-2" style={{ gap: u(7) }}>
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

/* ---------------------------------------------------------------- cover -- */

function Cover({ slide }: { slide: Extract<Slide, { kind: "cover" }> }) {
  return (
    <div className="cover-grid h-full" style={{ gap: u(5) }}>
      <div className="flex min-h-0 flex-col justify-between">
        <div className="flex items-center" style={{ gap: u(1.4) }}>
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--display)",
              fontSize: u(2.1),
              letterSpacing: "0.35em",
              lineHeight: 1,
            }}
          >
            Stiff
          </span>
          <Asterisk className="text-[var(--fg)]" style={{ width: u(2.6), height: u(2.6) }} />
        </div>

        <div>
          <p className="t-eyebrow">{slide.eyebrow}</p>
          <h1 className="t-title t-title--xl" style={{ marginTop: u(2), maxWidth: "100%" }}>
            {slide.title}
          </h1>
          <p className="t-body" style={{ marginTop: u(2.6), maxWidth: "92%" }}>
            {slide.sub}
          </p>
        </div>
      </div>

      <div className="cover-plate min-h-0 overflow-hidden" style={{ background: "var(--surf)" }}>
        <Plate
          id={slide.plate}
          priority
          sizes="(min-width: 900px) 45vw, 90vw"
          className="h-full w-full object-cover grayscale"
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- plate -- */

function PlateSlide({ slide }: { slide: Extract<Slide, { kind: "plate" }> }) {
  return (
    <div className="relative h-full w-full" style={{ background: "var(--surf)" }}>
      <Plate
        id={slide.plate}
        sizes="100vw"
        className="absolute inset-0 h-full w-full object-cover grayscale"
      />
      {/* Type sits in an inverted band rather than on the photograph, so its
          contrast is a known quantity instead of whatever the picture does. */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-end justify-between"
        style={{
          background: "var(--fg)",
          color: "var(--bg)",
          padding: `${u(3)} ${u(6.5)} ${u(3.4)}`,
          gap: u(4),
        }}
      >
        <div>
          <p className="t-eyebrow" style={{ color: "var(--bg)", opacity: 0.7 }}>
            {slide.chapter}
          </p>
          <p className="plate-title" style={{ marginTop: u(1.2) }}>
            {slide.title}
          </p>
        </div>
        <p className="t-body" style={{ color: "var(--bg)", opacity: 0.8, maxWidth: "40%" }}>
          {slide.caption}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- stats -- */

function Stats({ stats }: { stats: Stat[] }) {
  const cols = stats.length >= 4 ? "cols-4" : "cols-3";
  const long = stats.some((s) => s.value.length > 4);
  return (
    <div
      className={`${cols} ink border-t`}
      style={{ gap: u(3), paddingTop: u(2.6) }}
    >
      {stats.map((s) => (
        <div key={s.label}>
          <div
            className="t-big num"
            style={long ? { fontSize: u(7.2) } : undefined}
          >
            {s.value}
          </div>
          <div className="t-eyebrow" style={{ marginTop: u(1.4), color: "var(--fg)" }}>
            {s.label}
          </div>
          {s.note ? (
            <div className="t-small" style={{ marginTop: u(0.6) }}>
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
  const cols = points.length >= 4 ? "cols-4" : points.length === 2 ? "cols-2" : "cols-3";
  return (
    <div className={cols} style={{ gap: u(3.2) }}>
      {points.map((p) => (
        <div
          key={p.label}
          className={`flex flex-col border-t ${p.tone ? `tone-${p.tone}` : ""}`}
          style={{
            borderColor: p.tone ? "var(--tone)" : "var(--fg)",
            borderTopWidth: u(0.28),
            paddingTop: u(1.6),
            gap: u(1.2),
          }}
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
          paddingTop: u(1.4),
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <ul className="m-0 list-none p-0" style={{ marginTop: u(1.2) }}>
        {items.map((it) => (
          <li
            key={it}
            className="t-body hair border-b"
            style={{ padding: `${u(0.95)} 0`, color: "var(--fg)", fontSize: u(1.95) }}
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
  const columns = items.length > 8;
  if (columns) {
    return (
      <div className="flex flex-col" style={{ gap: u(2.4) }}>
        <ul className="cols-3 m-0 list-none p-0" style={{ columnGap: u(4), rowGap: 0 }}>
          {items.map((it) => (
            <li
              key={it}
              className="t-body hair flex items-center border-b"
              style={{ gap: u(1.4), padding: `${u(0.9)} 0`, color: "var(--fg)" }}
            >
              <Asterisk
                className="shrink-0"
                style={{ width: u(1.3), height: u(1.3), color: "var(--accent)" }}
              />
              {it}
            </li>
          ))}
        </ul>
        {tail ? (
          <p className="t-lead" style={{ maxWidth: "86%" }}>
            {tail}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: u(2.4) }}>
      <ol className="m-0 list-none p-0" style={{ maxWidth: "80%" }}>
        {items.map((it, i) => {
          const last = emphasiseLast && i === items.length - 1;
          return (
            <li
              key={it}
              className={`flex items-baseline border-t ${last ? "ink border-b" : "hair"}`}
              style={{ gap: u(2.4), padding: `${u(0.8)} 0` }}
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
      {tail ? (
        <p className="t-body" style={{ maxWidth: "80%", fontSize: u(1.9) }}>
          {tail}
        </p>
      ) : null}
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
            marginLeft: u(i * 9),
            gap: u(3),
            paddingTop: u(1.2),
            paddingBottom: u(1.3),
          }}
        >
          <span className="t-mid num" style={{ color: "var(--mute)", width: u(4.5), fontSize: u(2.6) }}>
            {d.day}
          </span>
          <span className="flex-1">
            <span
              className="block uppercase"
              style={{
                fontFamily: "var(--display)",
                fontSize: u(3),
                lineHeight: 1,
                letterSpacing: "0.02em",
              }}
            >
              {d.name}
            </span>
            <span className="t-eyebrow block" style={{ marginTop: u(0.7) }}>
              {d.cap} · {d.clock} clock
            </span>
          </span>
          <span className="t-big num" style={{ fontSize: u(6.2) }}>
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
    <ol className="cols-3 m-0 list-none p-0" style={{ gap: `${u(3)} ${u(3.6)}` }}>
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
              fontSize: u(2.7),
              lineHeight: 1,
              letterSpacing: "0.02em",
            }}
          >
            {s.title}
          </span>
          <span className="t-body" style={{ fontSize: u(1.85) }}>
            {s.text}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ---------------------------------------------------------------- dares -- */

function Dares({ dares }: { dares: Dare[] }) {
  return (
    <div className="cols-3" style={{ gap: u(2.4) }}>
      {dares.map((d) => (
        <div
          key={d.n}
          className="flex flex-col"
          style={{
            background: "var(--surf)",
            padding: `${u(2)} ${u(2.2)} ${u(2.2)}`,
            gap: u(1.4),
            minHeight: u(24),
          }}
        >
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
          <p className="t-body flex-1" style={{ color: "var(--fg)", fontSize: u(1.95) }}>
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
  const cols = `${u(2.2)} ${u(14)} 1.45fr 1fr ${u(10.5)}`;
  const cell = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    fontSize: u(1.35),
    lineHeight: 1.3,
    ...extra,
  });
  return (
    <div className="flex flex-col">
      <div
        className="ink grid items-baseline border-b"
        style={{ gridTemplateColumns: cols, gap: u(1.8), paddingBottom: u(0.6) }}
      >
        <span />
        <span className="t-eyebrow" style={{ fontSize: u(1.05) }}>Level</span>
        <span className="t-eyebrow" style={{ fontSize: u(1.05) }}>Where it stands</span>
        <span className="t-eyebrow" style={{ fontSize: u(1.05) }}>Gate</span>
        <span className="t-eyebrow justify-self-end" style={{ fontSize: u(1.05) }}>Status</span>
      </div>
      {levels.map((l) => {
        const filled = l.status === "built";
        return (
          <div
            key={l.n}
            className="hair grid items-baseline border-b"
            style={{ gridTemplateColumns: cols, gap: u(1.6), padding: `${u(0.48)} 0` }}
          >
            <span className="t-eyebrow num" style={{ fontSize: u(1.1) }}>
              {l.n}
            </span>
            <span style={cell({ color: "var(--fg)", fontWeight: 600, fontSize: u(1.55) })}>
              {l.name}
            </span>
            <span style={cell({ color: "var(--fg)" })}>{l.state}</span>
            <span style={cell({ color: "var(--mute)" })}>{l.gate}</span>
            <span
              className="t-eyebrow justify-self-end border text-center"
              style={{
                borderColor: l.status === "planned" ? "var(--rule)" : "var(--fg)",
                background: filled ? "var(--fg)" : "transparent",
                color: filled
                  ? "var(--bg)"
                  : l.status === "planned"
                    ? "var(--mute)"
                    : "var(--fg)",
                padding: `${u(0.35)} ${u(0.7)}`,
                fontSize: u(0.9),
                minWidth: u(11),
                whiteSpace: "nowrap",
              }}
            >
              {STATUS_LABEL[l.status]}
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
  const box = (dashed?: boolean): React.CSSProperties => ({
    border: `1px ${dashed ? "dashed" : "solid"} var(--fg)`,
    padding: `${u(1.5)} ${u(1.8)}`,
  });
  return (
    <div className="flex h-full flex-col justify-center" style={{ gap: u(1.6) }}>
      <div className="cols-4" style={{ gap: u(1.6) }}>
        {sites.map((s) => (
          <div key={s.host} style={box(s.dashed)}>
            <div className="t-body num" style={{ color: "var(--fg)", fontWeight: 600, fontSize: u(1.9) }}>
              {s.host}
            </div>
            <div className="t-small">{s.role}</div>
            <div className="t-eyebrow" style={{ marginTop: u(0.9), fontSize: u(1.05) }}>
              {s.state}
            </div>
          </div>
        ))}
      </div>

      <Connector label="one session model · shop, staff and admin tokens are not interchangeable" />

      <div
        className="flex items-baseline justify-between"
        style={{ ...box(false), background: "var(--fg)", color: "var(--bg)" }}
      >
        <span
          className="uppercase"
          style={{ fontFamily: "var(--display)", fontSize: u(2.8), lineHeight: 1, letterSpacing: "0.02em" }}
        >
          One NestJS API
        </span>
        <span className="t-eyebrow num" style={{ color: "var(--bg)", opacity: 0.75 }}>
          /api · /api/staff · /api/admin · /api/game — on Render
        </span>
      </div>

      <Connector label="every admin write audited · migrations reviewed as code" />

      <div className="cols-4" style={{ gap: u(1.6) }}>
        {services.map((s) => (
          <div key={s.name} className="hair border-t" style={{ paddingTop: u(1.1) }}>
            <div className="t-body" style={{ color: "var(--fg)", fontWeight: 600, fontSize: u(1.9) }}>
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
      <span className="t-eyebrow" style={{ fontSize: u(1.05) }}>
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
    <div className="flex flex-col" style={{ gap: u(2.6) }}>
      <div className="cols-2" style={{ gap: u(7) }}>
        <div>
          <p className="t-eyebrow">Raising</p>
          <p className="t-big" style={{ marginTop: u(1), fontSize: u(6.5) }}>
            {ASK.amount ?? <Blank>amount</Blank>}
          </p>
          <p className="t-body" style={{ marginTop: u(1.4), fontSize: u(1.9) }}>
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
                className="hair flex items-baseline justify-between border-b"
                style={{ padding: `${u(0.75)} 0`, gap: u(2) }}
              >
                <span className="t-body" style={{ color: "var(--fg)", fontSize: u(1.9), whiteSpace: "nowrap" }}>
                  {f.share}
                </span>
                <span className="t-small text-right" style={{ fontSize: u(1.45) }}>
                  {f.note}
                </span>
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
          <p className="t-body" style={{ marginTop: u(0.6), fontSize: u(1.9) }}>
            <Blank>names and roles — set TEAM in src/content/deck.ts</Blank>
          </p>
        )}
      </div>
    </div>
  );
}
