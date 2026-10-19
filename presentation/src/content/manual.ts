/**
 * STIFF — the operator's manual, sponsor edition.
 *
 * Fifteen pages, one argument: a city plays a filmed three-day dare game, a
 * second audience watches and judges it, and a brand can be the dare. Read
 * the titles alone and the book should still make the case.
 *
 * The book is sent ahead as often as it is presented, so every page carries
 * its reading text (`body`) under the figure; there are no speaker notes.
 *
 * Sources, and the rule about them:
 *   - the game as built, on the `game` branch: backend/src/game/* (rules.ts,
 *     README.md, the AI charter and blocklist, the report rules);
 *   - public statistics, named where they are used: Geostat (Tbilisi's
 *     population), DataReportal Digital 2025: Georgia (social media users).
 * Anything else is stamped:
 *   - PROJECTED: prices and season sizes. Nothing here has been sold yet,
 *     and season one has not run. They live in `SEASONS` and `PACKAGES` so a
 *     figure and the sentence about it cannot disagree.
 * Clans and clan wars are archived in the code (`CLANS_ARCHIVED`), so they
 * are not offered here.
 */

export interface Stat {
  value: string;
  label: string;
  note?: string;
}

export interface Step {
  key: string;
  text: string;
}

export interface Side {
  name: string;
  tag: string;
  /** Colour is structural in the game: heart = player, glow = watcher. */
  tone: "heart" | "glow";
  items: string[];
}

export interface Row {
  /** The first cell names the row and must be unique within its table. */
  cells: string[];
  tone?: "strong" | "coin" | "off";
}

export interface Tier {
  name: string;
  price: string;
  text: string;
  /** The package most sponsors should land on; set in coin. */
  headline?: boolean;
}

export interface Check {
  label: string;
  text: string;
}

export interface Bar {
  name: string;
  value: number;
  display: string;
  /** Optional second, thinner track on the same scale. */
  cost?: number;
  note: string;
}

export interface StatusRow {
  label: string;
  live: boolean;
  text: string;
}

interface Base {
  id: string;
  /** Running head: the world and level this page belongs to. */
  stage: string;
  /** The takeaway. */
  title: string;
  lede?: string;
  body?: string[];
  /** Set in the footer: PROJECTED, a source, a status. */
  stamp?: string;
}

export type Page =
  | {
      kind: "cover";
      id: string;
      top: [string, string];
      title: string;
      edition: string;
      sub: string;
      bottom: string[];
    }
  | (Base & { kind: "stats"; stats: Stat[] })
  | (Base & { kind: "steps"; steps: Step[] })
  | (Base & { kind: "sides"; left: Side; right: Side })
  | (Base & { kind: "big"; value: string; label: string; sum: string[] })
  | (Base & { kind: "table"; columns: string[]; rows: Row[]; widths: string })
  | (Base & { kind: "tiers"; tiers: Tier[] })
  | (Base & { kind: "checks"; checks: Check[] })
  | (Base & { kind: "bars"; bars: Bar[] })
  | (Base & { kind: "status"; rows: StatusRow[] })
  | (Base & { kind: "continue"; question: string; body: string[] });

/* ---------------------------------------------------------------------------
   Fill this in. `null` renders as a visible blank, never a made-up address.
   ------------------------------------------------------------------------- */

export const CONTACT = {
  site: "game.stiff.ge",
  email: null as string | null,
};

/* ---------------------------------------------------------------------------
   PROJECTED. Season sizes and package prices are planning assumptions, to be
   replaced by what season one measures.
   ------------------------------------------------------------------------- */

/** Rules from backend/src/game/rules.ts. */
const RULES = { days: 3, dailyMinimum: 4, hearts: 3, votingHours: 3 };

const SEASONS = [
  { name: "Season 01", players: 500 },
  { name: "Season 02", players: 2_500 },
  { name: "Season 03", players: 10_000 },
];

const PACKAGES = { task: 2_000, day: 5_000, season: 12_000 };

/** Written the way the game's shop writes it ("5 GEL"): the pixel face has no ₾. */
const gel = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} GEL`;
const num = (n: number) => n.toLocaleString("en-US");

/** The floor: every player at the daily minimum, every day of the season. */
const minHandIns = (players: number) => players * RULES.dailyMinimum * RULES.days;

/* ------------------------------------------------------------------------- */

export const MANUAL: Page[] = [
  {
    kind: "cover",
    id: "cover",
    top: ["Operator's manual", "Tbilisi · 2026"],
    title: "Operator's manual",
    edition: "Sponsor edition · Season 01",
    sub: "A three-day dare game played on the streets of Tbilisi: how it plays, who plays it, and how a brand gets in.",
    bottom: ["game.stiff.ge", "16+ only", "No real-money play"],
  },

  /* ============================================== WORLD 1 · THE GAME === */

  {
    kind: "stats",
    id: "what",
    stage: "1-1 · The game",
    title: "STIFF is a three-day dare game, played and filmed in Tbilisi.",
    lede: "Players take dares against a clock. Watchers judge them. Everything is on camera.",
    stats: [
      { value: String(RULES.days), label: "days a season", note: "harder every day; anyone can join on any day" },
      { value: String(RULES.dailyMinimum), label: "dares a day", note: "the minimum to stay a player, no maximum" },
      { value: "16+", label: "to play or watch", note: "checked at sign-up and again when a side is taken" },
    ],
    body: [
      "A season runs for three days. Each day has its own tier of dares, and each tier is harder and runs longer: 15, 20 and then 25 minutes on the clock. A player who hands in fewer than four dares in a day becomes a watcher at midnight.",
      "The dares are the kind friends set each other: blunt, funny, a little embarrassing, and safe. For example: wear every black thing you own at once, or get ten strangers to say the same three words on camera.",
    ],
  },

  {
    kind: "steps",
    id: "loop",
    stage: "1-2 · The game",
    title: "The server deals the dare, runs the clock and pays out. The phone only proves it.",
    steps: [
      { key: "Draw", text: "The server deals an approved dare from the day's tier that this player hasn't had yet." },
      { key: "Accept", text: "The clock starts on server time. Declining a dare or running out of time costs a heart." },
      { key: "Prove", text: "A photo or a clip, uploaded from the phone straight to storage." },
      { key: "Vote", text: `Watchers have ${RULES.votingHours} hours to vote yes or no.` },
      { key: "Verdict", text: "An AI model or a person on the team decides, with the votes as evidence." },
      { key: "Pay", text: "Nerve (the score) and opals (the coins) are paid out. Every payment is logged." },
    ],
    body: [
      "Only approved hand-ins reach the public feed. A clip always goes to a person on the team; a photo is checked by an AI model first. A sponsor's dare runs on the same path as every other dare, under the same review.",
    ],
  },

  {
    kind: "sides",
    id: "sides",
    stage: "1-3 · The game",
    title: "Two audiences in one game: the ones who do it, and the ones who judge it.",
    left: {
      name: "Player",
      tag: `${RULES.hearts} hearts · a clock · a camera`,
      tone: "heart",
      items: [
        "Takes dares and films them",
        "Earns Nerve, the score on the board",
        "Loses a heart for every refused or missed dare",
        "Out of hearts means becoming a watcher",
      ],
    },
    right: {
      name: "Watcher",
      tag: "No clock · nothing to lose",
      tone: "glow",
      items: [
        "Watches every hand-in and votes on it",
        "Gets paid in opals for every correct call",
        "Spends opals in the rewards shop",
        "Stays for the whole season",
      ],
    },
    body: [
      "Everyone picks a side once a season. A player who drops out becomes a watcher and stays in the game. So the audience grows as the season goes on: every player who loses keeps watching.",
    ],
  },

  {
    kind: "stats",
    id: "return",
    stage: "1-4 · The game",
    title: "The rules bring people back several times a day, three days in a row.",
    stats: [
      { value: String(RULES.dailyMinimum), label: "dares a day", note: "or the player becomes a watcher at midnight" },
      { value: String(RULES.hearts), label: "hearts", note: "they only go down, so every choice counts" },
      { value: `${RULES.votingHours}h`, label: "to vote", note: "a reason to check the feed all day" },
      { value: "5h", label: "watcher cooldown", note: "after a paid vote, so watchers keep coming back" },
    ],
    body: [
      "Each rule is a reason to open the game again. A player has to hand in four dares a day. A watcher has a three-hour window to vote, and has to wait five hours between paid votes. Both of them check back all day.",
      "The board, the feed and the rewards shop are all public, no account needed. Anyone can see what is happening before signing up.",
    ],
  },

  {
    kind: "big",
    id: "content",
    stage: "1-5 · The game",
    title: "One season of 500 players makes at least 6,000 filmed hand-ins.",
    value: num(minHandIns(SEASONS[0].players)),
    label: "hand-ins, at minimum",
    sum: [
      num(SEASONS[0].players),
      " players × ",
      String(RULES.dailyMinimum),
      " dares × ",
      String(RULES.days),
      " days",
    ],
    body: [
      "That is a floor: it assumes every player does the minimum and nothing more. Every approved hand-in is a photo or a clip of a real person in Tbilisi, and none of it costs anyone a production budget.",
      "Anyone can share a hand-in as an Instagram Stories card without an account, and every share is counted. The players are the ones spreading it.",
    ],
    stamp: "PROJECTED · Season 01 size",
  },

  /* ========================================== WORLD 2 · THE AUDIENCE === */

  {
    kind: "stats",
    id: "city",
    stage: "2-1 · The audience",
    title: "Season one needs 500 players in a city of 1.33 million.",
    stats: [
      { value: "1.33M", label: "live in Tbilisi", note: "a third of Georgia (Geostat, 2025)" },
      { value: "3.0M", label: "social media users", note: "78.8% of Georgia (DataReportal, Jan 2025)" },
      { value: "16+", label: "the youngest player", note: "the age gate covers watchers too" },
    ],
    body: [
      "All the game needs is a phone with a camera and a data plan, and Georgia's audience is on its phones and on social media. The players are young people in Tbilisi with a phone in their hand, out in the city.",
      "Seasons can grow without changing the rules: nobody is cut by rank, and anyone can join on any day. Going from 500 players to 10,000 means changing one setting.",
    ],
  },

  {
    kind: "table",
    id: "placements",
    stage: "2-2 · The audience",
    title: "A brand shows up inside the game, not next to it.",
    columns: ["Placement", "What the player sees", "Status"],
    widths: "1.1fr 2fr 1fr",
    rows: [
      { cells: ["Sponsored dare", "A dare built around your product, your place or your line", "Dare writer takes a theme"], tone: "strong" },
      { cells: ["Rewards shop", "Your product as a prize that watchers and players spend opals on", "Shop built"], tone: "coin" },
      { cells: ["A day of the season", "The whole day's tier carries your theme", "Next"] },
      { cells: ["The feed", "Every approved clip of your dare, public and shareable", "Feed built"] },
      { cells: ["Season title", "\"Season 01, presented by…\" on the cover of the game", "Next"] },
    ],
    body: [
      "The AI that writes dares already takes a theme, and the team approves every dare by hand before it goes live. The rewards shop already lets the team list a prize with a price in opals, a stock count and a limit per person. The day and season placements are what this partnership would build first.",
    ],
  },

  /* ============================================== WORLD 3 · THE DEAL === */

  {
    kind: "tiers",
    id: "packages",
    stage: "3-1 · The deal",
    title: "Three ways in, from one dare to the whole season.",
    tiers: [
      {
        name: "Dare",
        price: gel(PACKAGES.task),
        text: "One sponsored dare in the pool for a day, plus its clips in the feed and a report afterwards.",
      },
      {
        name: "Day",
        price: gel(PACKAGES.day),
        text: "A whole day's tier carries your theme, and your prize goes in the rewards shop.",
        headline: true,
      },
      {
        name: "Season",
        price: gel(PACKAGES.season),
        text: "The title of the season, all three days, the final and first refusal on the next season.",
      },
    ],
    body: [
      "These are starting prices for season one, set for a first season and a new audience. Once season one has measured what a dare actually delivers, the prices will follow those numbers.",
    ],
    stamp: "PROJECTED · Price hypotheses",
  },

  {
    kind: "bars",
    id: "scale",
    stage: "3-2 · The deal",
    title: "The same dare is worth more every season, because the field keeps growing.",
    bars: SEASONS.map((s) => ({
      name: s.name,
      value: s.players,
      display: `${num(s.players)} players`,
      note: `One ${gel(PACKAGES.task)} dare: ${(PACKAGES.task / s.players).toFixed(2)} GEL a player`,
    })),
    body: [
      "Season one is a small, invited field, which keeps it cheap to get in early. A sponsor that comes in now also gets first refusal when the field is bigger.",
    ],
    stamp: "PROJECTED · Season sizes",
  },

  /* ===================================== WORLD 4 · SAFETY AND PROOF === */

  {
    kind: "checks",
    id: "safety",
    stage: "4-1 · Safety",
    title: "Your name never sits next to a dangerous dare.",
    checks: [
      { label: "24 banned categories", text: "Drugs, weapons, theft, traffic, heights, fire, violence, anything sexual, minors, privacy, gambling and more." },
      { label: "Four checks", text: "An AI writes the dare, a hard filter screens it, a second AI reviews it and a person approves it." },
      { label: "Cheats caught", text: "Every photo is checked for faking. A confident catch wipes the player's score, hearts and opals." },
      { label: "Reports", text: "Anyone can report anything. Five reports from different accounts hide a hand-in until the team looks at it." },
      { label: "Not gambling", text: "Opals can never be turned back into money or sent to another player." },
    ],
    body: [
      "If the filter is unsure about a dare, the dare is blocked. A dare that fails review three times is dropped. A clip is never approved by the AI alone; a person on the team has to sign it off.",
    ],
  },

  {
    kind: "table",
    id: "report",
    stage: "4-2 · Proof",
    title: "Every number in your report comes straight from the game's database.",
    columns: ["You get", "Counted from"],
    widths: "1.3fr 2fr",
    rows: [
      { cells: ["Attempts", "every time a player was dealt your dare and accepted it"], tone: "strong" },
      { cells: ["Approved hand-ins", "clips and photos that passed review and reached the feed"] },
      { cells: ["Votes", "every yes and no from watchers in the three-hour window"] },
      { cells: ["Likes and comments", "on each of your dare's posts"] },
      { cells: ["Shares", "every time someone shared a post as a Stories card"] },
      { cells: ["Prizes claimed", "rewards-shop items bought with opals"], tone: "coin" },
    ],
    body: [
      "The game already logs every dare it deals, every vote and every opal paid out. The sponsor report is still to be built (see the next page), but it will be pulled from those records, not estimated.",
    ],
  },

  {
    kind: "status",
    id: "status",
    stage: "4-3 · Proof",
    title: "The game is built and live. Season one is what's left.",
    rows: [
      { label: "Rules", live: true, text: "Seasons, the three daily tiers, hearts, clocks, Nerve and opals." },
      { label: "Dares", live: true, text: "Four AI agents and a review queue, with a person approving every dare." },
      { label: "Feed", live: true, text: "Public feed, board and rewards shop, with Stories sharing." },
      { label: "Site", live: true, text: "game.stiff.ge, redesigned for the cabinet look." },
      { label: "Payments", live: false, text: "Opal packs by TBC and BOG card, waiting on the banks' merchant credentials." },
      { label: "Sponsors", live: false, text: "Day and season placements, and the sponsor report." },
      { label: "Season 01", live: false, text: "500 invited players, prizes, a camera at the final." },
    ],
    body: [
      "The parts that are hard to build already work and are tested. What's left is the first season itself, and a sponsor can be part of it from day one.",
    ],
  },

  {
    kind: "continue",
    id: "continue",
    stage: "Continue",
    title: "Continue?",
    question: "Sponsor Season 01?",
    body: [
      "Pick a package, or tell us what you sell and we'll pitch you the dare.",
    ],
  },
];

/** 1-based, zero-padded folio, counted like the HUD: the cover is 01. */
export function folio(index: number): string {
  return String(index + 1).padStart(2, "0");
}
