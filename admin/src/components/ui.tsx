import { AsteriskMark } from "./asterisk-mark";

/*
 * The panel's primitives.
 *
 * Every screen is built from these, which is the only reason eight of them
 * read as one product. Class recipes rather than styled wrappers: a recipe
 * composes with a one-off `className` at the call site, and nothing here is
 * dynamic enough to earn a component.
 *
 * The scale is deliberately short. Two button sizes, three tones, one card,
 * one table. A system with an option for everything is a system nobody
 * follows.
 */

// ------------------------------------------------------------------ type --

/** Small, uppercase, letterspaced. The only place uppercase still earns it. */
export const eyebrow =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted";

/** A screen's title. Display face, tight, set once per page. */
export const pageTitle =
  "font-display text-[28px] leading-[1.1] sm:text-[34px]";

/** A block's title inside a screen. */
export const sectionTitle = "text-[15px] font-bold tracking-[-0.01em]";

export const labelCls =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted";

/** Kept for screens still written against the old names. */
export const eyebrowCls = eyebrow;

// --------------------------------------------------------------- buttons --

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold whitespace-nowrap transition-[background-color,border-color,color,opacity] duration-150 disabled:cursor-not-allowed disabled:opacity-45";

/** The one affirmative action on a screen. There should rarely be two. */
export const btnPrimary = `${buttonBase} h-10 bg-ink px-5 text-[12px] uppercase tracking-[0.1em] text-card hover:opacity-85`;

export const btnPrimarySm = `${buttonBase} h-8 bg-ink px-3.5 text-[11px] uppercase tracking-[0.08em] text-card hover:opacity-85`;

/** Everything else that is still a real action. */
export const btnSecondary = `${buttonBase} h-10 border border-line-strong bg-card px-5 text-[12px] uppercase tracking-[0.1em] text-ink hover:border-ink`;

export const btnSecondarySm = `${buttonBase} h-8 border border-line-strong bg-card px-3.5 text-[11px] uppercase tracking-[0.08em] text-ink hover:border-ink`;

/** Inline, inside a row. Reads as a link but hits like a button. */
export const btnGhost =
  "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] text-[12px] font-semibold text-muted underline-offset-4 transition-colors hover:text-ink hover:underline disabled:cursor-not-allowed disabled:opacity-45";

/** Destructive, and it should look it before it is pressed. */
export const btnDanger = `${buttonBase} h-8 border border-danger/40 bg-danger-tint px-3.5 text-[11px] uppercase tracking-[0.08em] text-danger hover:border-danger`;

/** Square icon button — the header's search, bell, theme. */
export const btnIcon =
  "inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] border border-line text-muted transition-colors hover:border-line-strong hover:text-ink";

/* The shop panel's names, so screens can move over one at a time. */
export const btnSolid = btnPrimary;
export const btnSolidSm = btnPrimarySm;
export const btnOutline = btnSecondary;
export const btnGhostSm = btnGhost;

/** A filter chip. Active is filled, because a filter you forgot is a bug. */
export function chipCls(active: boolean): string {
  return `inline-flex h-8 items-center rounded-[var(--radius-pill)] px-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
    active
      ? "bg-ink text-card"
      : "border border-line text-muted hover:border-line-strong hover:text-ink"
  }`;
}

// ---------------------------------------------------------------- inputs --

const fieldBase =
  "w-full rounded-[var(--radius-control)] border border-line bg-card text-[13px] text-ink transition-colors placeholder:text-faint focus:border-ink focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const inputCls = `${fieldBase} h-10 px-3`;
export const textareaCls = `${fieldBase} px-3 py-2.5 leading-6`;
export const selectCls = `${fieldBase} h-10 px-2.5 pr-8 font-medium`;
export const checkboxCls =
  "size-4 shrink-0 accent-[var(--ink)] disabled:opacity-50";

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-5 text-faint">{hint}</p>}
    </div>
  );
}

// ----------------------------------------------------------------- cards --

export const cardCls =
  "rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]";

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`${cardCls} ${className}`}>{children}</div>;
}

/** A card with a title bar and, usually, one control on the right. */
export function Panel({
  title,
  eyebrow: eyebrowText,
  aside,
  bleed = false,
  className = "",
  children,
}: {
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  aside?: React.ReactNode;
  /** Let a table run to the card's edge instead of sitting inside padding. */
  bleed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${cardCls} ${className}`}>
      {(title || aside) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            {eyebrowText && <p className={eyebrow}>{eyebrowText}</p>}
            {title && (
              <h2 className={`${sectionTitle} ${eyebrowText ? "mt-1" : ""}`}>
                {title}
              </h2>
            )}
          </div>
          {aside && <div className="flex items-center gap-2">{aside}</div>}
        </header>
      )}
      <div className={bleed ? "" : "px-5 pb-5"}>{children}</div>
    </section>
  );
}

/** Section heading for content that is not inside a card. */
export function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className={sectionTitle}>{children}</h2>
      {aside}
    </div>
  );
}

// ----------------------------------------------------------------- state --

export type Tone = "neutral" | "solid" | "outline" | "positive" | "caution" | "danger" | "info";

const toneCls: Record<Tone, string> = {
  neutral: "border-line bg-raised text-muted",
  solid: "border-ink bg-ink text-card",
  outline: "border-line-strong bg-transparent text-ink",
  positive: "border-positive/25 bg-positive-tint text-positive",
  caution: "border-caution/25 bg-caution-tint text-caution",
  danger: "border-danger/25 bg-danger-tint text-danger",
  info: "border-info/25 bg-info-tint text-info",
};

/** A status word. Colour here is information; never use it for decoration. */
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${toneCls[tone]}`}
    >
      {children}
    </span>
  );
}

/** A dot before a word, when a full badge would be too loud in a dense row. */
export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  const fill =
    tone === "positive"
      ? "bg-positive"
      : tone === "caution"
        ? "bg-caution"
        : tone === "danger"
          ? "bg-danger"
          : tone === "info"
            ? "bg-info"
            : "bg-faint";
  return <span className={`inline-block size-1.5 rounded-full ${fill}`} />;
}

// ----------------------------------------------------------------- stats --

/**
 * One number, and what it means.
 *
 * The label sits above the value rather than below: a column of these is
 * scanned by label first, and a reader should not have to find the number to
 * know what they are looking at.
 */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Colours the value when the number itself is the warning. */
  tone?: "danger" | "caution";
}) {
  const valueColor =
    tone === "danger"
      ? "text-danger"
      : tone === "caution"
        ? "text-caution"
        : "text-ink";
  return (
    <div className="min-w-0">
      <p className={eyebrow}>{label}</p>
      <p
        className={`font-display tnum mt-2 text-[26px] leading-none ${valueColor}`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 truncate text-[11px] leading-5 text-faint">
          {hint}
        </p>
      )}
    </div>
  );
}

/** The row of stats at the top of a screen, in its own card. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${cardCls} grid grid-cols-2 gap-x-6 gap-y-7 p-5 sm:grid-cols-3 lg:grid-cols-6`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- tables --

export const tableCls = "w-full text-[13px]";
export const theadCls =
  "text-left text-[10px] font-bold uppercase tracking-[0.12em] text-faint";
export const thCls = "px-5 py-2.5 font-bold";
export const trCls = "border-t border-line transition-colors hover:bg-raised";
export const tdCls = "px-5 py-3.5 align-middle";

/** A horizontally scrollable wrapper, so a wide table never widens the page. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

// ------------------------------------------------------- keys and values --

export function Facts({
  rows,
}: {
  rows: { label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-[minmax(0,max-content)_1fr] gap-x-6 gap-y-2 text-[12px]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-faint">{row.label}</dt>
          <dd className="min-w-0 break-words text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------- loading, empty, error --

/** The asterisk is the mark, so it is the loader. */
export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <AsteriskMark
      className={`${className} animate-asterisk-tick text-muted`}
      aria-hidden="true"
    />
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 py-10 text-[12px] text-muted"
    >
      <Spinner />
      <span className="uppercase tracking-[0.12em]">{label}</span>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="my-4 rounded-[var(--radius-control)] border border-danger/25 bg-danger-tint px-4 py-3 text-[12px] leading-6 text-danger"
    >
      {message}
    </p>
  );
}

/** An empty screen is an invitation to act, so it says what to do next. */
export function Empty({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <AsteriskMark className="size-5 text-line-strong" aria-hidden="true" />
      <p className="max-w-sm text-[13px] leading-6 text-muted">{children}</p>
      {action}
    </div>
  );
}

/**
 * A one-line result of the last action taken. Always in the same place.
 *
 * The element stays in the DOM even when empty, because a live region that
 * appears at the same moment as its text is a live region a screen reader
 * may never announce. It collapses to nothing instead of reserving a blank
 * strip — an empty band under a card reads as a rendering fault.
 */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p aria-live="polite" className="text-[12px] leading-5 text-muted empty:hidden">
      {children}
    </p>
  );
}
