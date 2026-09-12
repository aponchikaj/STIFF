/*
 * One icon per section, drawn to a single 20px grid with a 1.6 stroke.
 *
 * Hand-drawn rather than a library because the set is eight glyphs and each
 * one should say what its screen actually holds — a heart for the players
 * whose season it ends, a clock for the queue that expires, a flag for what
 * people have reported. A generic pack would give eight rounded squares.
 */

type Props = { className?: string };

function Svg({ children, className = "size-[18px]" }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Overview — four panes, the shape of a dashboard. */
export const IconOverview = (p: Props) => (
  <Svg {...p}>
    <rect x="2.5" y="2.5" width="6" height="6" rx="1.3" />
    <rect x="11.5" y="2.5" width="6" height="6" rx="1.3" />
    <rect x="2.5" y="11.5" width="6" height="6" rx="1.3" />
    <rect x="11.5" y="11.5" width="6" height="6" rx="1.3" />
  </Svg>
);

/** Seasons — a calendar, because a season is a run of days. */
export const IconSeason = (p: Props) => (
  <Svg {...p}>
    <rect x="2.5" y="4" width="15" height="13.5" rx="2" />
    <path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3" />
  </Svg>
);

/** Review — a clock, because everything in the queue is against one. */
export const IconReview = (p: Props) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 5.75V10l3 1.75" />
  </Svg>
);

/** Players — a heart, the thing they lose. */
export const IconPlayers = (p: Props) => (
  <Svg {...p}>
    <path d="M10 16.5S3 12.6 3 7.9A3.9 3.9 0 0 1 10 5.6a3.9 3.9 0 0 1 7 2.3c0 4.7-7 8.6-7 8.6Z" />
  </Svg>
);

/** Board — three bars, tallest first: a ranking, read left to right. */
export const IconBoard = (p: Props) => (
  <Svg {...p}>
    <path d="M4 17V6.5M10 17v-8M16 17v-4.5" />
    <path d="M2.5 17.5h15" />
  </Svg>
);

/** Tasks — a brief with a line of writing on it. */
export const IconTasks = (p: Props) => (
  <Svg {...p}>
    <path d="M5 2.5h7l3.5 3.5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" />
    <path d="M11.5 2.5V6h3.7M7 10.5h6M7 13.5h4" />
  </Svg>
);

/** Coin shop — a coin. */
export const IconShop = (p: Props) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 6.2v7.6M12 8.1a2.4 2.4 0 0 0-2-.9c-1.2 0-2 .6-2 1.5 0 2.2 4 1 4 3.1 0 .9-.9 1.5-2 1.5a2.5 2.5 0 0 1-2.1-1" />
  </Svg>
);

/** Reports — a flag. Someone raised it; someone has to lower it. */
export const IconReports = (p: Props) => (
  <Svg {...p}>
    <path d="M4.5 17.5V3" />
    <path d="M4.5 3.8h9.8l-1.8 3.4 1.8 3.4H4.5" />
  </Svg>
);

export const IconLogout = (p: Props) => (
  <Svg {...p}>
    <path d="M7.5 17.5H4.5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h3" />
    <path d="M12.5 13.5 16 10l-3.5-3.5M16 10H7" />
  </Svg>
);

export const IconExternal = (p: Props) => (
  <Svg {...p}>
    <path d="M8 4H4.5v11.5H16V12" />
    <path d="M11 3.5h5.5V9M16 3.5 9 10.5" />
  </Svg>
);
