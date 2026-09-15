/**
 * STIFF — the investor journal and deck. The shop at stiff.ge, the game at
 * stiff.co.
 *
 * Fifteen pages, one argument: a clothing brand built a game to own its
 * audience, and the game pays for itself before it fills the shop. The
 * journal (`/`) and the presented deck (`/deck`) are the same fifteen pages;
 * `journalOnly` still exists for a page that should stay out of the room.
 *
 * Pages are data so the engines can count, link and lay them out before a
 * single one renders, and so the reading mode can print every slide with its
 * notes from the same source. Nothing is quoted twice.
 *
 * Sources, and the rule about them:
 *   - the code on `main` — backend/src/game/*, backend/src/payments/*,
 *     backend/src/orders/* — and counts taken from the repository, a test
 *     run and a read-only query of the live database on 15 September 2026;
 *   - docs/game/hosting.md for the running cost;
 *   - public statistics, named where they are used: Geostat (Tbilisi's
 *     population, the average wage), DataReportal Digital 2025: Georgia
 *     (internet and social media users), the National Bank of Georgia (the
 *     lari rate).
 * Every figure is one of those, with two marked exceptions:
 *   - PROJECTED — prices, conversion rates, sponsorship and everything
 *     computed from them. They live in `MODEL` below, so a chart and a
 *     headline cannot disagree, and changing one assumption changes both;
 *   - DERIVED — arithmetic done here from a sourced figure (cost per
 *     participant from the hosting note's season month).
 *
 * Presented-slide budget: about twenty words on the slide, the rest in
 * `notes`. The notes are the reading deck — printed under each slide in
 * reading mode, shown to the presenter, and set as the body of each journal
 * page.
 */

export type Theme = "light" | "dark";

export interface Stat {
  value: string;
  label: string;
  note?: string;
}

export interface Point {
  label: string;
  text: string;
  /** Colour is structural in the game: hot = player, cold = watcher, amber = held. */
  tone?: "hot" | "cold" | "amber";
}

export interface Step {
  n: string;
  title: string;
  text: string;
}

export interface Dare {
  n: string;
  tier: string;
  title: string;
  brief: string;
  kind: string;
}

export interface LadderDay {
  day: string;
  name: string;
  count: string;
  /** What `count` counts, set small under it. */
  unit?: string;
  cap: string;
  clock: string;
}

export type LevelStatus = "built" | "partial" | "next" | "planned";

export interface Level {
  n: string;
  name: string;
  weeks: string;
  status: LevelStatus;
  state: string;
  gate: string;
}

export interface TableRow {
  /** The first cell names the rule and must be unique within its table. */
  cells: string[];
  /** Set the whole row in ink — the row the table is about. */
  strong?: boolean;
}

export type ChartId = "r2-vs-aws" | "revenue-seasons" | "monthly-bill" | "war-book";

interface Base {
  id: string;
  /** Running head — the chapter this slide belongs to. */
  section: string;
  theme: Theme;
  /** The takeaway. Read the titles alone and the deck should still argue. */
  title: string;
  notes: string[];
  /** In the journal, left out of the presented deck. No page uses it today. */
  journalOnly?: boolean;
}

export type Slide = Base &
  (
    | { kind: "cover"; eyebrow: string; sub: string; plate: string }
    | { kind: "plate"; plate: string; chapter: string; caption: string }
    | { kind: "statement"; body?: string[]; stats?: Stat[]; foot?: string }
    | { kind: "points"; points: Point[]; foot?: string }
    | { kind: "stats"; stats: Stat[]; foot?: string }
    | { kind: "chart"; chart: ChartId; foot?: string }
    | { kind: "arch" }
    | { kind: "ladder"; days: LadderDay[]; foot?: string }
    | { kind: "steps"; steps: Step[] }
    | {
        kind: "two";
        left: { label: string; tone?: Point["tone"]; items: string[] };
        right: { label: string; tone?: Point["tone"]; items: string[] };
        foot?: string;
      }
    | { kind: "list"; items: string[]; tail?: string; emphasiseLast?: boolean }
    | { kind: "dares"; dares: Dare[]; foot?: string }
    | { kind: "roadmap"; levels: Level[]; foot?: string }
    | { kind: "table"; columns: string[]; rows: TableRow[]; foot?: string }
    | { kind: "ask" }
  );

/* ---------------------------------------------------------------------------
   Fill these in. They are the only things in the deck that are not known
   from the repository or the model. Anything left as `null` renders as a
   visible blank rather than a made-up number.
   ------------------------------------------------------------------------- */

export const ASK = {
  /** e.g. "$150,000" or "₾400,000". */
  amount: null as string | null,
  /** e.g. "18 months" */
  runway: null as string | null,
  useOfFunds: [
    { share: "1 · Player app", note: "stiff.co, on the API that already exists" },
    { share: "2 · Revenue on", note: "coin bundles and the pass on TBC / BOG cards" },
    { share: "3 · Season one", note: "500 players, prizes, a camera at the final" },
    { share: "4 · Legal and running", note: "coins sold to 16+, prizes; ≈ $267 a month" },
  ],
  milestone: "season one played by 500 people, first revenue banked, conversion rates measured.",
};

export const TEAM: { name: string; role: string }[] = [
  // { name: "…", role: "…" },
];

export const CONTACT = {
  site: "stiff.ge",
  email: null as string | null,
};

/* ---------------------------------------------------------------------------
   The revenue model. PROJECTED: every rate and price below is a planning
   assumption to be replaced by season one's measurements. Prices are in
   lari because that is what a player pays; totals are shown in dollars.
   ------------------------------------------------------------------------- */

export const MODEL = {
  /** Lari per US dollar. The National Bank of Georgia set 2.61 on 11 Sep 2026. */
  fx: 2.6,
  /** Share of participants who buy coins in a season, and what they spend. */
  coins: { share: 0.06, spendGel: 20 },
  /** Share of participants who buy the season pass, and its price. */
  pass: { share: 0.1, priceGel: 15 },
  /** Share of participants who place a shop order that season, and its size. */
  shop: { share: 0.02, orderGel: 140 },
  /**
   * DERIVED. The hosting note's ceiling season month — $520 for 1,000
   * players with the AI running — divided per participant, and held as a
   * floor below 1,000 because infrastructure does not shrink with the field.
   */
  costPerParticipantUsd: 0.52,
  seasonCostFloorUsd: 520,
  seasons: [
    { name: "Season one", participants: 500, sponsoredTasks: 0, sponsoredTaskGel: 0 },
    { name: "Season two", participants: 2_500, sponsoredTasks: 5, sponsoredTaskGel: 2_000 },
    { name: "Season three", participants: 10_000, sponsoredTasks: 10, sponsoredTaskGel: 3_000 },
  ],
};

export type ModelSeason = (typeof MODEL.seasons)[number];

/** One season's book, in lari and dollars, from `MODEL` alone. */
export function seasonBook(s: ModelSeason) {
  const coins = s.participants * MODEL.coins.share * MODEL.coins.spendGel;
  const pass = s.participants * MODEL.pass.share * MODEL.pass.priceGel;
  const shop = s.participants * MODEL.shop.share * MODEL.shop.orderGel;
  const sponsors = s.sponsoredTasks * s.sponsoredTaskGel;
  const gel = coins + pass + shop + sponsors;
  const usd = (n: number) => n / MODEL.fx;
  const cost = Math.max(MODEL.seasonCostFloorUsd, s.participants * MODEL.costPerParticipantUsd);
  return {
    gel,
    lines: [
      { label: "Coin bundles", usd: usd(coins) },
      { label: "Season pass", usd: usd(pass) },
      { label: "Shop orders", usd: usd(shop) },
      { label: "Sponsored tasks", usd: usd(sponsors) },
    ],
    revenueUsd: usd(gel),
    costUsd: cost,
    contributionUsd: usd(gel) - cost,
  };
}

/* ------------------------------------------------------------------------- */

export const SLIDES: Slide[] = [
  /* ================================================== I · THE BET === */

  {
    id: "cover",
    kind: "cover",
    section: "STIFF",
    theme: "light",
    eyebrow: "Investor journal · Tbilisi · September 2026",
    title: "Essential clothing. And a game the city pays to play.",
    sub: "STIFF is a Tbilisi clothing brand with a finished shop at stiff.ge and a three-day dare game at stiff.co — built to own an audience, and to sell to it.",
    plate: "0035",
    notes: [
      "Fifteen pages. The first five are what STIFF is and why people come back; the next seven are how it makes money and what that costs; the last three are what is already built, what we designed out, and what we are asking for.",
      "Every figure is measured from the repository and the live database on 15 September 2026, or quoted from a named public source. Prices, conversion rates and everything computed from them are PROJECTED and stamped as such — season one has not run, and this journal does not pretend it has.",
    ],
  },

  {
    id: "problem",
    kind: "statement",
    section: "The problem",
    theme: "light",
    title: "A small brand rents its audience every month and never owns it.",
    body: [
      "Ads stop the day the spend stops.",
      "A drop lands, goes quiet, and the next one starts from zero.",
    ],
    notes: [
      "STIFF makes a small line of heavy, essential clothing designed and worn in Tbilisi. The shop, the archive and the collab films are finished. What a brand this size does not have is a reason for people to come back between drops — and every customer it wins through paid reach has to be bought again next time.",
      "The game is the answer to that: an audience that shows up every day for three days, films itself doing it, and pays for the privilege. The brand stops renting attention and starts owning it — and the attention itself becomes a revenue line before a single garment is sold.",
    ],
  },

  /* ================================================= II · THE GAME === */

  {
    id: "what",
    kind: "statement",
    section: "The game",
    theme: "dark",
    title: "Stiff is a three-day dare game. You film it, the watchers call it, and nobody is cut.",
    stats: [
      { value: "3", label: "days a season", note: "harder every day; enrolment open on all of them" },
      { value: "4", label: "tasks a day", note: "the minimum to stay a player — no maximum" },
      { value: "16+", label: "to play or watch", note: "checked at sign-up and at every enrolment" },
    ],
    notes: [
      "A player asks the server for a dare, accepts it, and a clock starts — 15, 20 or 25 minutes depending on the day. They do it, photograph or film it on their own phone, and hand it in. Watchers vote on it for three hours; a model or a person decides; an approved hand-in pays Nerve, the score, and coins, the currency.",
      "Two roles, chosen once a season. Players take dares and have three hearts; declining or running out the clock burns one. Watchers vote, earn coins for calling hand-ins right, and bet coins on clan wars. Nobody is eliminated for where they placed — only for what they did.",
      "The dares are a dare between friends: blunt, funny, a little gross, completely safe. 'Wear every black item you own, all at once.' 'Convince a stranger to wear your jacket for thirty seconds.' 'Ten strangers, the same three words, on camera.'",
    ],
  },

  {
    id: "loop",
    kind: "steps",
    section: "The game",
    theme: "dark",
    title: "The server draws, times and pays. The phone only proves what happened.",
    steps: [
      { n: "01", title: "Draw", text: "The server picks an approved dare at the day's tier." },
      { n: "02", title: "Accept", text: "A clock starts on server time. Declining costs a heart." },
      { n: "03", title: "Prove", text: "A photo or clip, straight to storage." },
      { n: "04", title: "Vote", text: "Watchers have three hours to say yes or no." },
      { n: "05", title: "Verdict", text: "A model or a person decides." },
      { n: "06", title: "Pay", text: "Nerve and coins move, with a ledger row each." },
    ],
    notes: [
      "The whole loop is built and tested on main: 90 API routes, 982 of the backend's 1,333 tests, and a thirteen-screen control room at admin.stiff.co that runs a season without anyone touching the database.",
      "Every coin that moves is a row in an append-only ledger, written in the same transaction as the balance. That matters commercially: once coins are sold for money, the ledger is what makes a refund, a chargeback or a dispute answerable to the lari.",
      "Uploads never pass through the API — the phone gets a signed URL and sends the file straight to Cloudflare R2, which charges nothing to serve it back. That single decision is why a filmed game costs dollars, not hundreds, to run.",
    ],
  },

  {
    id: "retention",
    kind: "points",
    section: "Why they come back",
    theme: "dark",
    title: "Every rule is built to bring someone back tomorrow — and bring a friend.",
    points: [
      {
        label: "The daily minimum",
        tone: "hot",
        text: "Four hand-ins a day or you become a watcher. Three days in a row, by design.",
      },
      {
        label: "Clans of two",
        tone: "hot",
        text: "Team dares pay both and cost both. Nobody plays a clan alone.",
      },
      {
        label: "Paid watchers",
        tone: "cold",
        text: "A correct yes pays 2–5 coins. The audience has a reason to stay.",
      },
      {
        label: "Clan wars",
        tone: "amber",
        text: "Four hours, most Nerve wins, and everyone else bets coins on it.",
      },
    ],
    foot: "Every approved hand-in is a filmed piece of content anyone can share. The players make the marketing.",
    notes: [
      "The mechanics are retention mechanics first. A minimum of four hand-ins a day means a player opens the game at least four times a day for three days. Hearts that only go down make every decision matter. A clan is exactly two people, locked for the season, so every clan is an invitation someone had to send.",
      "Watchers are not an afterthought — they are the audience a sponsor pays for. They are paid in coins for voting right, they bet coins on clan wars, and they spend in the same coin shop. The feed, the board and the wars are readable signed out, because they are what makes someone want an account.",
      "The content is the acquisition channel. Every hand-in is a photo or clip of a real person in Tbilisi doing something worth watching, shareable signed out. A season of 500 players at the four-a-day minimum is at least 6,000 hand-ins — six thousand pieces of user-made content, none of which STIFF paid to produce.",
    ],
  },

  {
    id: "market",
    kind: "stats",
    section: "The market",
    theme: "light",
    title: "Season one needs 500 people in a city of 1.33 million.",
    stats: [
      { value: "1.33M", label: "live in Tbilisi", note: "a third of Georgia — Geostat, 2025" },
      { value: "3.0M", label: "social media users", note: "78.8% of Georgia — DataReportal, Jan 2025" },
      { value: "₾2,364", label: "average monthly wage", note: "Geostat, Q1 2026, up 8.9% on a year" },
    ],
    foot: "Season one is 0.04% of one city. The ask is not to win a market — it is to fill one season, measure it, and grow the field.",
    notes: [
      "Tbilisi holds about 1.33 million people, a third of the country, and Georgia is a phone-first, social-first market: 3.12 million internet users and 3.0 million social media identities at the start of 2025, with median mobile download speeds up 232% in a year. The game needs exactly what that market already has — a phone with a camera and a data plan.",
      "Wages are rising fast: the average monthly nominal wage reached ₾2,364 in the first quarter of 2026, 8.9% up on a year. A ₾15 season pass is 0.6% of that — the price of a coffee and a pastry, for three days of a city-wide game.",
      "The expansion path is built in rather than bolted on: the game has no rank cut-offs and enrolment never closes, so a season can grow from 500 to 10,000 without changing a rule. The same backend already speaks to a separate domain, stiff.co, so a second city is a season setting, not a rebuild.",
    ],
  },

  /* ============================================== III · THE MONEY === */

  {
    id: "revenue-lines",
    kind: "table",
    section: "How it makes money",
    theme: "light",
    title: "Four ways the game earns money — and one it never will.",
    columns: ["Revenue line", "Who pays, for what", "Where it stands"],
    rows: [
      { cells: ["Coin bundles", "players and watchers, for coins to spend and bet", "coins, ledger and shop built; card sale next"], strong: true },
      { cells: ["Season pass", "players, before a season opens", "decided; not built"] },
      { cells: ["Shop orders", "participants who become customers — the reason the game exists", "the shop is finished and waiting"] },
      { cells: ["Sponsored dares", "brands, for a dare every player attempts that day", "from season two, once there is an audience"] },
      { cells: ["Cash-out, or betting for money", "nobody, ever", "designed out"] },
    ],
    notes: [
      "Coin bundles are the first line and the largest early one. Coins already exist in the game — earned from dares, from correct votes and from winning bets, and spent in the coin shop, on clan-war stakes and on team penalties. Selling them adds one more way in. Purchases go through the TBC and Bank of Georgia card acquirers the shop already integrates, through the same payments service that decides when a shop order is paid.",
      "The season pass is sold before a season opens, which makes it cash in hand before the season's costs are spent. Its contents are to be designed, with one fixed rule: it may never buy Nerve or hearts, because a score you can buy is a game nobody trusts.",
      "Shop orders are why the game exists. Four of the written dares already take a garment variant — 'wear every black item you own, with your STIFF on the outside' — and a QR code on a garment opens a private collab film, which is exactly the shape a sponsored drop takes. Sponsorship waits for season two because sponsors buy proven reach, and there is none until season one is filmed.",
      "What we will never sell: a way to turn coins back into money. See page fourteen.",
    ],
  },

  {
    id: "economy",
    kind: "two",
    section: "The coin economy",
    theme: "light",
    title: "Coins buy everything except the score. That is what keeps buying fair.",
    left: {
      label: "Coins",
      items: [
        "Earned from play — and bought by card",
        "Spent in the shop, on war stakes, on penalties",
        "A 10% war rake burns them, keeping them scarce",
      ],
    },
    right: {
      label: "Nerve",
      items: [
        "The score: the only thing the board reads",
        "Never bought, spent or bet",
        "Decides every clan war — coins never do",
      ],
    },
    foot: "A watcher can earn at most 75 coins a season by voting. That scarcity is what a bundle sells.",
    notes: [
      "The economy is designed so that paying helps you enjoy the game without letting you win it. Coins buy the things around the contest — coin-shop items, a bigger stake on a clan war, absorbing a team penalty. Nerve decides the board and every war, and no amount of money touches it.",
      "Hearts work like Nerve: three a season, never sold. Scarcity is built in, and it is what makes coins worth buying. A paid vote starts a five-hour cooldown, so a watcher earns at most 25 coins a day and 75 in a three-day season. A dare pays 1 to 20 coins. A clan-war bet can be up to 500. The gap between what the game gives away and what people want to do with coins is the product.",
      "Sinks keep that gap open. The house keeps 10% of every losing war pool, removing coins from circulation; team dares that fail cost each member 1 to 3 coins; the coin shop takes coins out for merch, a place at the final or whatever the season offers. A currency with sinks holds its value, so a coin bought on day one is still worth something on day three.",
    ],
  },

  {
    id: "pricing",
    kind: "table",
    section: "Pricing",
    theme: "light",
    title: "Priced for a Tbilisi pocket: nothing in the game costs more than a lunch.",
    columns: ["Product", "Price", "The reasoning"],
    rows: [
      { cells: ["Coins · small", "₾5", "an impulse buy — a first bet on a clan war"] },
      { cells: ["Coins · medium", "₾15", "the bundle most buyers should land on"], strong: true },
      { cells: ["Coins · large", "₾35", "for clans that bet on every war"] },
      { cells: ["Season pass", "₾15", "0.6% of the average monthly wage, bought before day one"] },
      { cells: ["Shop order", "≈ ₾140", "one heavy essential; free pickup in Tbilisi"] },
      { cells: ["Sponsored dare", "₾2,000–3,000", "one brand, every player, one day, all of it filmed"] },
    ],
    foot: "PROJECTED. Price hypotheses to test in season one — no price is live, and the coin shop's own prices are set by an admin.",
    notes: [
      "These are starting prices, set against local income rather than copied from a mobile-game benchmark: the medium bundle and the season pass are each about 0.6% of Georgia's average monthly wage of ₾2,364 (Geostat, Q1 2026).",
      "The model assumes 6% of participants buy coins and spend ₾20 a season — one medium bundle and one small. Both are deliberately modest; we will not claim a social game converts better than a solo one until season one measures it.",
      "Coins and the pass are card-only, through TBC and BOG — an instant digital good does not suit cash on delivery or bank transfer. Shop shipping is already live: free pickup, ₾5 courier in Tbilisi, ₾10 to the regions.",
    ],
  },

  {
    id: "unit-economics",
    kind: "stats",
    section: "Unit economics",
    theme: "light",
    title: "Each participant brings about $2.12 a season and costs at most $0.52 to serve.",
    stats: [
      { value: "$2.12", label: "revenue a participant", note: "₾5.50: coins, pass and shop, before sponsors" },
      { value: "$0.52", label: "cost to serve, ceiling", note: "hosting, media and AI, at 1,000 players" },
      { value: "4×", label: "revenue over cost", note: "before the team, prizes and garment cost" },
      { value: "6%", label: "need to buy coins", note: "and 10% the pass, 2% the shop" },
    ],
    foot: "PROJECTED revenue from MODEL in src/content/deck.ts; cost DERIVED from docs/game/hosting.md.",
    notes: [
      "Revenue per participant, per season, before any sponsor: 6% buy ₾20 of coins (₾1.20), 10% buy a ₾15 pass (₾1.50), and 2% place a ₾140 shop order (₾2.80). ₾5.50 in all, or $2.12 at ₾2.60 to the dollar (the National Bank of Georgia set 2.61 on 11 September 2026).",
      "Cost per participant is the ceiling case from the hosting note: $520 for a season month with 1,000 players, medium viewing and the AI running — $0.52 each. It is a ceiling, not an estimate: $267 of it is infrastructure that does not grow one-for-one with players, and the AI line was sized as a range of $50 to $250.",
      "Two honest caveats. Shop revenue is sales, not margin — the cost of the garment comes out of it. And the ratio excludes salaries and prizes, which are in the use of funds rather than the cost to serve. What the page shows is that the marginal participant is profitable from the first season, so growth does not burn money.",
    ],
  },

  {
    id: "revenue-seasons",
    kind: "chart",
    section: "Projection",
    theme: "light",
    title: "Covers its running cost from season one. $33k a season by season three.",
    chart: "revenue-seasons",
    notes: [
      "Season one is 500 invited players with no sponsors: about $1,060 of revenue against a $520 cost floor — it covers its running cost, not the team. It is not meant to make money; it is meant to prove the rates on the previous page and film a final that sells season two.",
      "Season two grows the field to 2,500 and adds five sponsored dares at ₾2,000 each: about $9,100 of revenue against $1,300 of cost. Season three is 10,000 participants and ten sponsored dares at ₾3,000: about $32,700 against $5,200.",
      "The largest lever is not on the chart: cadence. A season is three days, and nothing in the rules stops one running every month. Twelve seasons a year at season three's size is about $390,000 of revenue from the game and the shop orders it drives. We have not assumed that — it is what the rates, once measured, would let us plan.",
      "Every number here comes from MODEL in src/content/deck.ts, and the chart computes from it rather than having figures typed in, so changing an assumption changes the chart and this page together.",
    ],
  },

  {
    id: "cost",
    kind: "chart",
    section: "Running cost",
    theme: "light",
    title: "The whole operation runs under a $750 ceiling. A season month is $267.",
    chart: "monthly-bill",
    notes: [
      "Steady state — shop live, no season — is about $131 a month: Vercel, a Render instance for the API, Supabase Postgres, Cloudflare with R2 for media, Upstash Redis and Resend for mail.",
      "A season month with a thousand players and medium viewing is about $267. The step up is a larger API instance for the clocks and the review queue and a larger database — not media, because uploads bypass the API and R2 charges nothing for serving video. The same season served from AWS would cost $70 in egress at medium viewing and $344 if it went viral; on R2 it is one or two dollars.",
      "Running the AI adds $50 to $250, which is genuinely unknown until a season runs. The ceiling case is about $520, with $230 of headroom. The raise is not buying servers; it is buying the app, the season and the people.",
    ],
  },

  /* ========================================= IV · WHY IT IS FUNDABLE === */

  {
    id: "built",
    kind: "stats",
    section: "What exists",
    theme: "light",
    title: "The expensive part is already built. The raise pays for the last mile.",
    stats: [
      { value: "1,333", label: "tests passing", note: "in 64 suites; 982 are the game's" },
      { value: "231", label: "API routes", note: "90 of them the game's" },
      { value: "4", label: "AI agents", note: "write dares, check them, catch cheats, settle votes" },
      { value: "4", label: "payment rails", note: "TBC and BOG cards, bank transfer, cash on delivery" },
    ],
    foot: "Counted from the repository, a test run and the database on 15 September 2026.",
    notes: [
      "One NestJS backend, about 35,700 lines of application code, already serves five sites: the shop at stiff.ge, the staff workspace, the shop's admin panel, the game's control room at admin.stiff.co and the game's API. The shop is finished — catalogue with per-variant stock, guest checkout in lari, orders, a gallery archive and QR-linked collab films. It deliberately shows a holding page until the game launches, so the first drop has an audience waiting.",
      "What is not built, in the order a season needs it: the player's app at stiff.co (every rule is an endpoint without a screen), dares entered into the pool (22 are written), coin bundles and the season pass on the card acquirers, live bank credentials, and prizes. None is a redesign — each plugs into a service that already exists. By the roadmap's own estimates that is about five weeks of build before season one.",
      "This is a pre-revenue company. On 15 September the database has one test season and nothing in the coin shop. The claim is not traction; it is that the platform an investor would normally be paying to build is done, tested and running.",
    ],
  },

  {
    id: "risks",
    kind: "points",
    section: "Risk",
    theme: "dark",
    title: "The risks that sink games like this were designed out before the first player.",
    points: [
      {
        label: "Not gambling",
        tone: "amber",
        text: "Coins are sold, never cashed out, never sent between people. A bet is coins against coins.",
      },
      {
        label: "Not pay-to-win",
        tone: "amber",
        text: "Nerve and hearts can never be bought, so the board stays worth watching.",
      },
      {
        label: "Not dangerous",
        tone: "hot",
        text: "24 things a dare may never be, checked three times — two agents and a hard screen.",
      },
      {
        label: "Not faked",
        tone: "cold",
        text: "Every photo is checked for cheating; a confident verdict zeroes the account.",
      },
    ],
    foot: "The payment rails the shop depends on are protected on purpose: nothing in the game looks like gambling to a card acquirer.",
    notes: [
      "Betting was asked for with real money and built with coins only. A book on real money is a licensed gambling operation in Georgia, the game admits sixteen-year-olds, and the TBC and Bank of Georgia merchant agreements that carry the shop's card payments do not cover gambling. Buy-in, wager and cash-out together is the shape a regulator looks for; the cash-out is missing permanently, not for now.",
      "The blocklist covers substances, weapons, theft, traffic, heights, fire, violence, anything sexual, minors, privacy, gambling and more — 24 categories. Every dare passes a creator agent that has the rules in context, a deterministic screen that fails closed, a reviewer agent that assumes the creator was careless, and a person who approves it into the pool.",
      "The cheat detector reads every photo hand-in and acts at 0.85 confidence: the account goes to watcher, Nerve, hearts and coins to zero, and its comments are labelled. An admin can reinstate in one call. Clips always go to a person. Legal advice on selling coins to 16+ players and on prizes is in the use of funds, because it gates season one.",
    ],
  },

  {
    id: "ask",
    kind: "ask",
    section: "The ask",
    theme: "light",
    title: "The raise turns a built platform into a paying season.",
    notes: [
      "Use of funds follows the order revenue switches on. First the player app, because nothing sells without a screen. Then coin bundles and the season pass on the card rails the shop already has, with live bank credentials. Then season one itself — 500 players, prizes, stock for the coin shop and a camera operator at the final, because the tape is what sells season two to players and to sponsors. Legal work on selling coins to 16+ players runs alongside, because it gates the season rather than the build.",
      "The milestone is a played season with real revenue and measured rates: the share who buy coins, the share who buy the pass, the share who become shop customers, and the cost per verified hand-in. Those four numbers replace every PROJECTED stamp in this journal, and they decide how big season two should be.",
      "The number that matters most is the last one on the model: new shop customers acquired. Everything else in this journal exists to move it.",
    ],
  },
];

/** The presented cut: every slide that is not marked `journalOnly`. */
export const DECK_SLIDES: Slide[] = SLIDES.filter((s) => !s.journalOnly);

/** 1-based folio for the counter; the cover has none. */
export function folio(index: number): string {
  return String(index + 1).padStart(2, "0");
}
