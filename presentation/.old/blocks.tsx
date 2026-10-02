import type { Block } from "@/content/blocks";
import { Chart } from "./charts";
import { Plate } from "./plate";

/**
 * Every measurement here is in `cqi` -- percent of the page's own width --
 * because the page is a container. One set of type sizes then holds from a
 * 320px phone to a wide spread without a single media query: the page scales,
 * and the type scales with it. `--ts` nudges the whole scale up in
 * single-page mode, where the page cannot get any wider.
 *
 * Colour vocabulary is the shop's: black on white, one neutral grey, hard
 * hairlines. No accent (brand.md).
 */

function Lead({ text }: { text: string }) {
  const first = text.slice(0, 1);
  const rest = text.slice(1);
  return (
    <p className="[font-size:calc(3.4cqi*var(--ts))] leading-[1.5] text-foreground">
      <span
        aria-hidden
        className="float-left mt-[0.8cqi] mr-[1.6cqi] mb-[-0.6cqi] font-[family-name:var(--font-archivo-black)] [font-size:calc(11cqi*var(--ts))] leading-[0.74] text-foreground"
      >
        {first}
      </span>
      {rest}
    </p>
  );
}

function Steps({
  items,
}: {
  items: { n: string; title: string; text: string }[];
}) {
  return (
    <ol className="flex flex-col gap-[2cqi]">
      {items.map((s) => (
        <li key={s.n} className="flex gap-[2.4cqi]">
          <span className="num w-[7cqi] shrink-0 pt-[0.5cqi] [font-size:calc(2.6cqi*var(--ts))] leading-none tracking-[0.1em] text-muted">
            {s.n}
          </span>
          <span className="border-l border-subtle pl-[2.4cqi]">
            <span className="label block [font-size:calc(2.4cqi*var(--ts))] text-foreground">
              {s.title}
            </span>
            <span className="mt-[0.9cqi] block [font-size:calc(2.8cqi*var(--ts))] leading-[1.5] text-muted">
              {s.text}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Ladder({
  days,
}: {
  days: { day: string; name: string; count: string; cap: string }[];
}) {
  return (
    <div className="flex flex-col">
      {days.map((d, i) => (
        <div
          key={d.day}
          className="flex items-baseline gap-[2.4cqi] border-t border-foreground pt-[1.6cqi] pb-[1.8cqi]"
          // Each rung is inset a little further, so the cut reads as a stair.
          style={{ marginLeft: `${i * 8}cqi` }}
        >
          <span className="num shrink-0 [font-size:calc(5cqi*var(--ts))] leading-none text-muted">
            {d.day}
          </span>
          <span className="flex-1">
            <span className="block font-[family-name:var(--font-archivo-black)] [font-size:calc(3.6cqi*var(--ts))] leading-tight text-foreground">
              {d.name}
            </span>
            <span className="label mt-[0.7cqi] block [font-size:calc(2.4cqi*var(--ts))]">
              {d.cap}
            </span>
          </span>
          <span className="num shrink-0 [font-size:calc(5.6cqi*var(--ts))] leading-none text-foreground">
            {d.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function Stats({
  items,
}: {
  items: { value: string; label: string; note?: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-[5cqi] gap-y-[2.5cqi] border-y border-foreground py-[2.6cqi]">
      {items.map((s) => (
        <div key={s.label} className="min-w-[16cqi] flex-1">
          <div className="num font-[family-name:var(--font-archivo-black)] [font-size:calc(8cqi*var(--ts))] leading-[0.86] text-foreground">
            {s.value}
          </div>
          <div className="label mt-[1.2cqi] [font-size:calc(2.4cqi*var(--ts))] text-foreground">
            {s.label}
          </div>
          {s.note ? (
            <div className="mt-[0.4cqi] [font-size:calc(2.4cqi*var(--ts))] leading-tight text-muted">
              {s.note}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Table({
  head,
  rows,
  note,
}: {
  head: string[];
  rows: string[][];
  note?: string;
}) {
  return (
    <div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`label border-b border-foreground pb-[1cqi] [font-size:calc(2.4cqi*var(--ts))] ${
                  i === 0 ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td
                  key={i}
                  className={`border-b border-subtle py-[1.35cqi] align-baseline ${
                    i === 0
                      ? "pr-[2cqi] [font-size:calc(2.8cqi*var(--ts))] text-muted"
                      : "num text-right [font-size:calc(3.4cqi*var(--ts))] text-foreground"
                  }`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {note ? (
        <p className="mt-[1.4cqi] [font-size:calc(2.4cqi*var(--ts))] leading-snug text-muted">
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "lead":
      return <Lead text={block.text} />;

    case "p":
      return (
        <p className="[font-size:calc(2.9cqi*var(--ts))] leading-[1.6] text-muted">
          {block.text}
        </p>
      );

    case "list":
      return (
        <ul className="flex flex-col">
          {block.items.map((it) => (
            <li
              key={it}
              className="flex gap-[2cqi] border-b border-subtle py-[1.1cqi] [font-size:calc(2.8cqi*var(--ts))] leading-tight text-muted"
            >
              <span aria-hidden className="shrink-0 text-foreground">
                ✳
              </span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );

    case "steps":
      return <Steps items={block.items} />;

    case "ladder":
      return <Ladder days={block.days} />;

    case "stats":
      return <Stats items={block.items} />;

    case "table":
      return <Table head={block.head} rows={block.rows} note={block.note} />;

    case "quote":
      return (
        <blockquote className="border-l-[0.6cqi] border-foreground pl-[3cqi]">
          <p className="font-[family-name:var(--font-archivo-black)] [font-size:calc(3.2cqi*var(--ts))] leading-[1.35] text-foreground">
            {block.text}
          </p>
          {block.attrib ? (
            <footer className="label mt-[1.2cqi] [font-size:calc(2.4cqi*var(--ts))]">
              {block.attrib}
            </footer>
          ) : null}
        </blockquote>
      );

    case "note":
      return (
        <p className="border-t border-foreground pt-[1.6cqi] [font-size:calc(2.4cqi*var(--ts))] leading-[1.5] text-muted">
          {block.text}
        </p>
      );

    case "rule":
      return (
        <div aria-hidden className="flex items-center gap-[1.5cqi] py-[0.4cqi]">
          <span className="h-px flex-1 bg-subtle" />
          <span className="[font-size:calc(2.6cqi*var(--ts))] leading-none text-foreground">
            ✳
          </span>
          <span className="h-px flex-1 bg-subtle" />
        </div>
      );

    case "chart":
      return <Chart id={block.id} />;

    case "figure":
      return (
        <figure className="m-0">
          <div className="w-full overflow-hidden bg-surface">
            <Plate
              id={block.plate}
              fit="tile"
              sizes="(min-width: 900px) 30vw, 60vw"
              className="block h-[26cqi] w-full object-cover grayscale"
            />
          </div>
          <figcaption className="label mt-[1.1cqi] [font-size:calc(2.4cqi*var(--ts))]">
            {block.caption}
          </figcaption>
        </figure>
      );
  }
}
