import type { Page } from "@/content/blocks";
import { BlockView } from "./blocks";
import { Plate } from "./plate";

/** The six-armed mark from brand.md, drawn rather than typed. */
export function Asterisk({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      {[0, 60, 120].map((a) => (
        <line
          key={a}
          x1="12"
          y1="2"
          x2="12"
          y2="22"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="butt"
          transform={`rotate(${a} 12 12)`}
        />
      ))}
    </svg>
  );
}

/**
 * Front board.
 *
 * White, like the shop. The photograph is a plate rather than a background —
 * it sits inside the page's margin with the type stacked beneath it, so the
 * cover reads as a printed sheet and not a hero banner.
 */
function Cover() {
  return (
    <div className="flex h-full flex-col justify-between bg-background px-[8cqi] py-[7cqi]">
      <header className="flex items-start justify-between">
        <span className="mark [font-size:calc(3.2cqi*var(--ts))] leading-none tracking-[0.35em] text-foreground">
          Stiff
        </span>
        <Asterisk className="h-[4.4cqi] w-[4.4cqi] text-foreground" />
      </header>

      <div className="my-[4cqi] min-h-0 flex-1 overflow-hidden bg-surface">
        <Plate
          id="0035"
          priority
          sizes="(min-width: 900px) 40vw, 80vw"
          className="h-full w-full object-cover grayscale"
        />
      </div>

      <div>
        <h1 className="[font-size:calc(19cqi*var(--ts))] leading-[0.78] tracking-[-0.03em] text-foreground">
          Opal
        </h1>
        <div className="mt-[3cqi] flex items-end justify-between gap-[3cqi] border-t border-foreground pt-[1.8cqi]">
          <p className="label [font-size:calc(2.4cqi*var(--ts))] text-foreground">
            A working journal
          </p>
          <p className="num label [font-size:calc(2.4cqi*var(--ts))]">
            Issue 01 · Tbilisi
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Back board — the closing argument, not a logo parking space. The six things
 * season one is measured on, and the one of them that decides anything.
 */
function BackBoard() {
  const measures = [
    "Cost per verified attempt",
    "Review queue depth",
    "Decline rate against pool supply",
    "Votes per published clip",
    "Players reaching day three with hearts",
    "New shop customers acquired",
  ];
  return (
    <div className="flex h-full flex-col justify-between bg-background px-[8cqi] py-[7cqi]">
      <div>
        <p className="label [font-size:calc(2.4cqi*var(--ts))] text-foreground">
          Season one · what gets measured
        </p>
        <ol className="mt-[2.4cqi] flex flex-col">
          {measures.map((m, i) => (
            <li
              key={m}
              className={`flex items-baseline gap-[2cqi] border-t border-subtle py-[1.3cqi] ${
                i === measures.length - 1 ? "border-b border-b-foreground" : ""
              }`}
            >
              <span className="num shrink-0 [font-size:calc(2.4cqi*var(--ts))] text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`[font-size:calc(2.7cqi*var(--ts))] leading-tight ${
                  i === measures.length - 1
                    ? "font-[family-name:var(--font-archivo-black)] text-foreground"
                    : "text-muted"
                }`}
              >
                {m}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-[2.2cqi] [font-size:calc(2.5cqi*var(--ts))] leading-[1.5] text-muted">
          Five of these tell you whether the game works. The sixth tells you
          whether it was worth building.
        </p>
      </div>

      <div className="my-[3cqi] min-h-0 flex-1 overflow-hidden bg-surface">
        <Plate
          id="0049"
          sizes="(min-width: 900px) 40vw, 80vw"
          className="h-full w-full object-cover grayscale"
        />
      </div>

      <footer className="flex items-end justify-between gap-[3cqi] border-t border-foreground pt-[1.8cqi]">
        <span className="mark [font-size:calc(3.2cqi*var(--ts))] leading-none tracking-[0.35em] text-foreground">
          Stiff
        </span>
        <Asterisk className="h-[3.6cqi] w-[3.6cqi] text-foreground" />
      </footer>
    </div>
  );
}

/** A full-bleed photograph, used as a chapter break. */
function PlatePage({ page }: { page: Extract<Page, { kind: "plate" }> }) {
  return (
    <div className="relative h-full w-full bg-surface">
      <Plate
        id={page.plate}
        sizes="(min-width: 900px) 46vw, 90vw"
        className="absolute inset-0 h-full w-full object-cover grayscale"
      />
      {/* The type sits in an inverted band rather than directly on the
          photograph, so the contrast is a known quantity instead of whatever
          the picture happens to be doing behind it. */}
      <div className="absolute inset-x-0 bottom-0 bg-foreground px-[7cqi] py-[3.4cqi] text-background">
        <p className="label [font-size:calc(2.4cqi*var(--ts))] text-background">
          {page.chapter}
        </p>
        <p className="mt-[0.8cqi] [font-size:calc(2.5cqi*var(--ts))] leading-tight text-background/75">
          {page.caption}
        </p>
      </div>
    </div>
  );
}

function TitlePage({ page }: { page: Extract<Page, { kind: "title" }> }) {
  return (
    <div className="flex h-full flex-col justify-center gap-[3.4cqi] px-[9cqi] py-[7cqi]">
      <Asterisk className="h-[5cqi] w-[5cqi] text-foreground" />
      <div>
        <h2 className="[font-size:calc(13cqi*var(--ts))] leading-[0.84] tracking-[-0.02em] text-foreground">
          {page.title}
        </h2>
        <p className="label mt-[2.4cqi] [font-size:calc(2.4cqi*var(--ts))]">
          {page.subtitle}
        </p>
      </div>
      <div className="flex flex-col gap-[2.4cqi]">
        {page.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>
    </div>
  );
}

function ContentPage({
  page,
  folio,
  side,
}: {
  page: Extract<Page, { kind: "page" }>;
  folio: string | null;
  side: "recto" | "verso";
}) {
  return (
    <div className="flex h-full flex-col px-[8cqi] py-[6cqi]">
      <header className="mb-[3cqi] shrink-0">
        <div className="flex items-center justify-between gap-[2cqi]">
          <span className="label [font-size:calc(2.4cqi*var(--ts))] whitespace-nowrap">
            {page.section}
          </span>
          <span aria-hidden className="h-px flex-1 bg-foreground" />
        </div>
        <h2 className="mt-[2.2cqi] [font-size:calc(6.6cqi*var(--ts))] leading-[0.98] tracking-[-0.01em] text-foreground">
          {page.title}
        </h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-[2.4cqi]">
        {page.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>

      <footer
        className={`mt-[2.4cqi] flex shrink-0 items-center gap-[2cqi] ${
          side === "verso" ? "flex-row" : "flex-row-reverse"
        }`}
      >
        <span className="num [font-size:calc(2.4cqi*var(--ts))] tracking-[0.1em] text-muted">
          {folio}
        </span>
        <span aria-hidden className="h-px flex-1 bg-subtle" />
      </footer>
    </div>
  );
}

export function PageFace({
  page,
  folio,
  side,
}: {
  page: Page | undefined;
  folio: string | null;
  side: "recto" | "verso";
}) {
  // A real book has blank versos. So does this one.
  if (!page) return <div className="h-full w-full bg-background" />;

  switch (page.kind) {
    case "cover":
      return <Cover />;
    case "back":
      return <BackBoard />;
    case "plate":
      return <PlatePage page={page} />;
    case "title":
      return <TitlePage page={page} />;
    case "page":
      return <ContentPage page={page} folio={folio} side={side} />;
  }
}
