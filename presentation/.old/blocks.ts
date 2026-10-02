/**
 * The vocabulary a journal page is written in.
 *
 * Pages are data, not JSX, for two reasons: the book engine needs to know how
 * many pages exist before it can lay out a single sheet, and a page that is
 * data can be measured, reordered and counted without being rendered.
 */

/** Charts are named, not configured. The data lives with the drawing in
    `components/charts.tsx`, so a page cannot quote a number the chart does
    not actually plot. */
export type ChartId =
  | "monthly-bill"
  | "r2-vs-aws"
  | "media-volume"
  | "build-timeline"
  | "revenue-split"
  | "task-categories";

export type Block =
  | { kind: "lead"; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: { n: string; title: string; text: string }[] }
  | { kind: "stats"; items: { value: string; label: string; note?: string }[] }
  | { kind: "table"; head: string[]; rows: string[][]; note?: string }
  | { kind: "quote"; text: string; attrib?: string }
  | {
      kind: "ladder";
      days: { day: string; name: string; count: string; cap: string }[];
    }
  | { kind: "note"; text: string }
  | { kind: "rule" }
  | { kind: "chart"; id: ChartId; caption?: string }
  /** An inline photograph inside a text page. */
  | { kind: "figure"; plate: string; caption: string };

export type Page =
  | { id: string; kind: "cover" }
  | { id: string; kind: "back" }
  /** A full-bleed photograph used as a chapter break. */
  | {
      id: string;
      kind: "plate";
      plate: string;
      chapter: string;
      caption: string;
    }
  | { id: string; kind: "title"; title: string; subtitle: string; blocks: Block[] }
  | {
      id: string;
      kind: "page";
      /** Running head — the section this page belongs to. */
      section: string;
      title: string;
      blocks: Block[];
    };
