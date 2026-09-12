/*
 * One icon per section, on a single 20px grid with a 1.6 stroke.
 *
 * Drawn rather than imported because the set is thirteen glyphs and each one
 * should say what its screen actually holds — a hanger for products, a
 * receipt for orders, an eye for the collab room nobody else can see. A
 * generic pack would give thirteen rounded squares.
 */

type Props = { className?: string };

function Svg({
  children,
  className = "size-[18px]",
}: Props & { children: React.ReactNode }) {
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

export const IconOverview = (p: Props) => (
  <Svg {...p}>
    <rect x="2.5" y="2.5" width="6" height="6" rx="1.3" />
    <rect x="11.5" y="2.5" width="6" height="6" rx="1.3" />
    <rect x="2.5" y="11.5" width="6" height="6" rx="1.3" />
    <rect x="11.5" y="11.5" width="6" height="6" rx="1.3" />
  </Svg>
);

/** Traffic — a rising line. */
export const IconTraffic = (p: Props) => (
  <Svg {...p}>
    <path d="M2.5 13.5 7 9l3 3 5.5-6" />
    <path d="M12.5 6.5h3.5V10" />
    <path d="M2.5 17.5h15" />
  </Svg>
);

/** Products — a hanger. */
export const IconProducts = (p: Props) => (
  <Svg {...p}>
    <path d="M10 7.5V6.2a1.7 1.7 0 1 1 1.7-1.7" />
    <path d="M10 7.5 3 12.4c-.8.6-.4 1.9.6 1.9h12.8c1 0 1.4-1.3.6-1.9L10 7.5Z" />
  </Svg>
);

/** Orders — a receipt with a torn foot. */
export const IconOrders = (p: Props) => (
  <Svg {...p}>
    <path d="M4.5 2.5h11v15l-2-1.3-1.8 1.3-1.7-1.3-1.7 1.3-1.8-1.3-2 1.3v-15Z" />
    <path d="M7.5 7h5M7.5 10.5h5" />
  </Svg>
);

/** Users — a person. */
export const IconUsers = (p: Props) => (
  <Svg {...p}>
    <circle cx="10" cy="6.8" r="3.1" />
    <path d="M3.8 17c.6-3.2 3.1-4.9 6.2-4.9s5.6 1.7 6.2 4.9" />
  </Svg>
);

/** Comments — a speech bubble. */
export const IconComments = (p: Props) => (
  <Svg {...p}>
    <path d="M17 10.4c0 3.3-3.1 6-7 6a8 8 0 0 1-2.3-.3L3.5 17.5l1-3A5.6 5.6 0 0 1 3 10.4c0-3.3 3.1-6 7-6s7 2.7 7 6Z" />
  </Svg>
);

/** Contacts — an envelope. */
export const IconContacts = (p: Props) => (
  <Svg {...p}>
    <rect x="2.5" y="4.5" width="15" height="11" rx="1.6" />
    <path d="m3 5.5 7 5 7-5" />
  </Svg>
);

/** Gallery — a framed picture with a horizon. */
export const IconGallery = (p: Props) => (
  <Svg {...p}>
    <rect x="2.5" y="3.5" width="15" height="13" rx="1.8" />
    <path d="m3 13 4-3.6 3.4 3 2.5-2.2L17 13.5" />
    <circle cx="7.2" cy="7.4" r="1.2" />
  </Svg>
);

/** Content — text on a page. */
export const IconContent = (p: Props) => (
  <Svg {...p}>
    <rect x="3.5" y="2.5" width="13" height="15" rx="1.8" />
    <path d="M6.8 6.5h6.4M6.8 10h6.4M6.8 13.5h3.6" />
  </Svg>
);

/** Collab — an eye. The room is a private view, admitted one at a time. */
export const IconCollab = (p: Props) => (
  <Svg {...p}>
    <path d="M1.8 10S4.8 4.8 10 4.8 18.2 10 18.2 10 15.2 15.2 10 15.2 1.8 10 1.8 10Z" />
    <circle cx="10" cy="10" r="2.4" />
  </Svg>
);

/** The game's coin shop, reachable from here as well as from its own panel. */
export const IconCoins = (p: Props) => (
  <Svg {...p}>
    <ellipse cx="10" cy="5.6" rx="6.5" ry="2.6" />
    <path d="M3.5 5.6v8.8c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6V5.6" />
    <path d="M3.5 10c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6" />
  </Svg>
);

/** Broadcast — a signal going out. */
export const IconBroadcast = (p: Props) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="2" />
    <path d="M6.3 13.7a5.2 5.2 0 0 1 0-7.4M13.7 6.3a5.2 5.2 0 0 1 0 7.4" />
    <path d="M3.8 16.2a9 9 0 0 1 0-12.4M16.2 3.8a9 9 0 0 1 0 12.4" />
  </Svg>
);

/** Audit — a list that cannot be edited, so: a ledger with a lock's shackle. */
export const IconAudit = (p: Props) => (
  <Svg {...p}>
    <path d="M4 2.5h9l3 3v12H4v-15Z" />
    <path d="M7 9h6M7 12.5h6" />
    <path d="M12.5 2.5V6H16" />
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
