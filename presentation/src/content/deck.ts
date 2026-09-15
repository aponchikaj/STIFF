/**
 * STIFF — the journal and the investor deck. The shop at stiff.ge, the game
 * at stiff.co.
 *
 * Pages are data so the engines can count, link and lay them out before a
 * single one renders, and so the reading mode can print every slide with its
 * notes from the same source. Nothing is quoted twice.
 *
 * Two cuts of one source:
 *   - the journal (`/`) is the whole book — every page below, including the
 *     rulebook pages marked `journalOnly`;
 *   - the deck (`/deck`) is the presented cut, `DECK_SLIDES`, which leaves
 *     the rulebook out.
 *
 * Sources, and the rule about them:
 *   - the code on `main` — backend/src/game/* (rules.ts, media-rules.ts,
 *     ai/charter.ts, ai/blocklist.ts, reports/report-rules.ts and the
 *     services), backend/src/payments/*, backend/src/orders/*
 *   - backend/src/game/README.md, the server's own rulebook
 *   - the game panel on the `game-admin` branch (game-admin/README.md)
 *   - the game's documents on the `game` branch — docs/game/ROADMAP.md,
 *     docs/game/hosting.md, docs/game/tasks/season-zero-tasks.md
 *   - counts taken from the repository, a test run and a read-only query of
 *     the live database on 15 September 2026
 * Every figure below is one of those, with two marked exceptions:
 *   - PROJECTED — the revenue split, a planning assumption;
 *   - DERIVED — arithmetic done here from the code's own constants (a
 *     watcher's maximum income, media volume under today's rules). The
 *     working is in the notes of the page that uses it.
 *
 * Where the code and the documents disagree, the code is the rule, and the
 * disagreement is written down on the "gaps" page rather than smoothed over.
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

export type ChartId = "r2-vs-aws" | "revenue-split" | "monthly-bill" | "war-book";

interface Base {
  id: string;
  /** Running head — the chapter this slide belongs to. */
  section: string;
  theme: Theme;
  /** The takeaway. Read the titles alone and the deck should still argue. */
  title: string;
  notes: string[];
  /**
   * A rulebook page: in the journal, left out of the presented deck. The
   * deck is argued in about thirty slides; the journal is where every rule
   * the server enforces is written down with its number.
   */
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
   from the repository. Anything left as `null` renders as a visible blank
   rather than a made-up number.
   ------------------------------------------------------------------------- */

export const ASK = {
  /** e.g. "$150,000" or "₾400,000". */
  amount: null as string | null,
  /** e.g. "18 months" */
  runway: null as string | null,
  useOfFunds: [
    { share: "Engineering", note: "the player app at stiff.co, coin bundles, season pass" },
    { share: "Season one", note: "prizes, the coin shop's stock, a camera at the final" },
    { share: "Running cost", note: "≈ $267 a season month, $131 steady, plus AI" },
    { share: "Legal", note: "16+, prizes, selling coins" },
  ],
  milestone: "season one played by 300–500 people, six numbers measured.",
};

export const TEAM: { name: string; role: string }[] = [
  // { name: "…", role: "…" },
];

export const CONTACT = {
  site: "stiff.ge",
  email: null as string | null,
};

/* ------------------------------------------------------------------------- */

export const SLIDES: Slide[] = [
  /* ===================================================== I · STIFF === */

  {
    id: "cover",
    kind: "cover",
    section: "STIFF",
    theme: "light",
    eyebrow: "Investor journal · Tbilisi · September 2026",
    title: "Essential clothing. And a game the city plays.",
    sub: "STIFF is a Tbilisi clothing brand with a finished shop at stiff.ge and a three-day dare game at stiff.co, built to fill it.",
    plate: "0035",
    notes: [
      "This journal is built from the repository, a test run and the live database on 15 September 2026. Every number is measured or quoted from the code; the two exceptions are stamped where they appear — PROJECTED for the revenue split, DERIVED for arithmetic done from the code's own rules.",
      "It is the long version. After the game's chapter it carries a rulebook: every rule the server enforces, with its number, what it pays and what it costs. The presented deck at /deck is the same argument without the rulebook pages.",
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
      "STIFF makes a small line of heavy, essential clothing designed and worn in Tbilisi first. The shop, the archive and the collab films are finished. What a brand this size does not have is a reason for people to come back between drops.",
      "The usual answer — paid reach and influencer spend — is rented. It produces a spike and leaves nothing behind. The question the game answers is how a brand this size builds an audience it owns.",
    ],
  },

  {
    id: "why-now",
    kind: "points",
    section: "Why now",
    theme: "light",
    title: "The cheapest audience to build is one that is doing something together.",
    points: [
      {
        label: "The phone",
        text: "Every player already owns the camera, the clock and the upload.",
      },
      {
        label: "The storage",
        text: "A season of video costs dollars, not hundreds, to serve on Cloudflare R2.",
      },
      {
        label: "The models",
        text: "Writing dares, checking them and catching a faked photo is an API call.",
      },
    ],
    notes: [
      "Three things make a filmed city game cheap enough for a clothing brand to run in 2026, and none of them existed in this form a few years ago.",
      "Object storage that does not charge egress changed the arithmetic: serving a thousand-player season's video is a dollar or two on R2, against tens or hundreds on AWS. That is the whole reason a small operator can afford a video game at all.",
      "Models that read an image and follow a written rulebook are the second. Stiff uses four of them — one writes tasks, one checks them, one looks for faked photos, one settles the watchers' vote — and none is trusted alone.",
      "Dropping live streaming was the decision that tied it together. Every attempt is a recording uploaded when the clock stops, which removes the streaming provider, the socket rooms and the concurrent-stream capacity from the plan, and survives a Georgian mobile network.",
    ],
  },

  {
    id: "arch",
    kind: "arch",
    section: "What exists",
    theme: "light",
    title: "One backend already serves five sites.",
    notes: [
      "One NestJS API on Render serves the shop at stiff.ge, the staff workspace, the shop's admin panel, the game's control room at admin.stiff.co and the game at stiff.co. Postgres is a hosted Supabase instance in Frankfurt; media goes to Cloudflare R2 at media.stiff.ge; mail is Resend; Redis on Upstash makes a second API instance safe and makes every scheduled job run once.",
      "The sessions are not interchangeable. Shop tokens carry no audience, staff tokens carry stiff-staff, admin tokens carry stiff-admin, and the guard refuses one presented as another even though the signing secret is shared. A player's game account is an ordinary shop account — one login for both sites. Every state-changing admin request is written to an audit log with credential-shaped keys stripped, and there is no endpoint that edits or deletes an entry.",
      "The game's panel is on stiff.co while the API is on stiff.ge — different registrable domains — so in production the panel proxies /api through its own origin to keep the session cookie first-party.",
      "The game's API — 90 routes under /api/game — and its control room are built. The player's app at stiff.co is the piece not yet started: every rule on the following pages is an endpoint without a screen.",
    ],
  },

  {
    id: "built",
    kind: "stats",
    section: "What exists",
    theme: "light",
    title: "The platform is built and tested. The shop is waiting on the game.",
    stats: [
      { value: "1,333", label: "tests", note: "in 64 suites, all passing; 982 are the game's" },
      { value: "231", label: "API routes", note: "90 of them the game's" },
      { value: "37", label: "migrations", note: "on a live, shared Postgres; 10 for the game" },
      { value: "56", label: "photographs", note: "in the archive, shot in Tbilisi" },
    ],
    foot: "Counted from the repository, a test run and the database on 15 September 2026.",
    notes: [
      "The backend is about 35,700 lines of application code in 36 controllers and 45 entities. The game module alone is about 15,700 lines across 18 tables, with 13,800 more lines of tests in 30 suites.",
      "stiff.ge deliberately serves a holding page today. The shop publishes after the game ships and a bug pass — the two are meant to launch as one thing, so that the first drop has an audience waiting for it rather than the other way round.",
      "The database holds real content only in the gallery archive. On 15 September it has one user, one product and one order, one closed test season, no game tasks and nothing in the coin shop. This is a pre-revenue company with a finished platform.",
    ],
  },

  {
    id: "shop",
    kind: "points",
    section: "The shop",
    theme: "light",
    title: "Everything a drop needs is live: catalogue, checkout, orders, archive.",
    points: [
      {
        label: "Catalogue",
        text: "Sizes and colourways as variants, each with its own stock. Two buyers cannot take the last one.",
      },
      {
        label: "Checkout",
        text: "Guest checkout in lari. Pickup free, Tbilisi courier ₾5, the regions ₾10. Four ways to pay.",
      },
      {
        label: "Orders",
        text: "Pending, paid, packed, shipped, delivered. A cancellation returns stock exactly once.",
      },
      {
        label: "Collab films",
        text: "A QR code on the garment opens a private film. STIFF × KEBURIA is the first.",
      },
    ],
    notes: [
      "The catalogue models a colourway as a variant with its own SKU and stock rather than as a separate product, and the stock decrement is a conditional UPDATE so two simultaneous purchases cannot both take the last unit.",
      "Guest checkout works by email, and a guest order can later be claimed by the account that earns it. Shipping is pickup in Tbilisi (free), Tbilisi courier (₾5) or the Georgian regions (₾10). The fees are placeholders until a courier contract exists, and a free-shipping threshold is built but off by default.",
      "The collab feature is the largest single feature in the shop — 21 routes. Codes are generated in batches, downloaded as a ZIP of QR codes, revoked and reissued. A scan opens a private film served through a signed, expiring session with byte-range support so a phone can seek. It is the mechanism a sponsored garment task would reuse.",
      "Around all of it: a gallery archive with slugs and alt text, comments and reactions, unified search, admin-editable site copy, notifications, first-party page-view analytics with nightly snapshots, eight transactional email templates, and six scheduled jobs that run once even on several instances.",
    ],
  },

  /* ================================================= II · THE GAME === */

  {
    id: "plate-game",
    kind: "plate",
    section: "The game",
    theme: "dark",
    title: "stiff.co",
    plate: "0036",
    chapter: "II · The game",
    caption: "Stiff, the game. Three days, one city, your own phone.",
    notes: [
      "Chapter two is the game. It shares the brand's name and gets its own domain and its own visual world — the pages go dark here on purpose; the shop is white, the game is not.",
    ],
  },

  {
    id: "what",
    kind: "statement",
    section: "The game",
    theme: "dark",
    title: "Stiff is a three-day dare game. You film it, the watchers call it, and nobody is cut.",
    stats: [
      { value: "16+", label: "to play or watch", note: "checked at sign-up and again on every enrolment" },
      { value: "3", label: "hearts", note: "they only ever go down" },
      { value: "4", label: "tasks a day", note: "the minimum; there is no maximum" },
    ],
    notes: [
      "A player asks the server for a dare, accepts it, and a clock starts — 15, 20 or 25 minutes depending on the day. They do it, photograph or film it on their own phone, and hand it in. Watchers vote on it for three hours; a model or a person decides; an approved hand-in pays Nerve, which is the score, and coins, which are the currency. Declining costs a heart, and so does letting the clock run out.",
      "There are two roles, chosen once a season. Players take dares. Watchers vote on hand-ins, earn coins for calling them right, and bet coins on clan wars. Only the game moves a player to watcher, and it does it for what they did — out of hearts, under the daily minimum, broke on every count, or caught cheating — never for where they placed.",
      "The board ranks and never cuts. The original design cut a 5,000-player field to 1,000 and then to 100; the owner removed that on 12 September. Enrolment never closes either: someone who hears about the game on day two joins on day two, at zero Nerve with three hearts.",
      "There is no live streaming, and that is a decision rather than a gap. Every attempt is a recording. What it costs is the feeling of watching together in the moment. What it buys is a game one person can operate, that survives a Georgian mobile network, and whose media bill is measured in single digits.",
    ],
  },

  {
    id: "ladder",
    kind: "ladder",
    section: "The game",
    theme: "dark",
    title: "Three days, three tiers. Harder every day, and the board never cuts.",
    days: [
      { day: "I", name: "Qualifier", count: "≈10", unit: "Nerve a task", cap: "indoors, no stranger", clock: "15 min" },
      { day: "II", name: "Nerve", count: "≈25", unit: "Nerve a task", cap: "social nerve allowed", clock: "20 min" },
      { day: "III", name: "Final", count: "≈50", unit: "Nerve a task", cap: "hard, worth watching", clock: "25 min" },
    ],
    foot: "Guideline rewards from the Charter the task-writing model reads; every task is bounded at 5–100 Nerve and 1–20 coins.",
    notes: [
      "The tier is the day: a draw on day two comes from tier-two tasks. The Charter tells the creator agent what each tier is for. Day one must be completable indoors with no stranger, no travel and no spending, because everyone attempts it. Day two may ask for social nerve, but not every task may need a stranger — a day that forces every player through the same social barrier loses the ones who freeze. Day three is hard and specific, and success should be genuinely uncertain.",
      "Rewards scale with the tier: about 10 Nerve for a qualifier, 25 on day two and 50 in the final — more for a dare that costs real nerve, never for one that is merely long. Coins run from 1 to 20 on the same scale.",
      "There are no cut lines. A player at 900th is as much in the game as the one at 1st. A player has to hand in at least four tasks every day to stay a player, and there is no upper limit — hand in twenty and all twenty can pay.",
      "One mismatch is written down on the gaps page: the Charter describes clips of up to 60 seconds, 3 minutes and 5 minutes by day, but the server accepts clips from 5 seconds to 2 minutes on every day. The server is the rule until one of them changes.",
    ],
  },

  {
    id: "loop",
    kind: "steps",
    section: "The game",
    theme: "dark",
    title: "The server draws, times and pays. The phone only proves what happened.",
    steps: [
      { n: "01", title: "Draw", text: "The server picks an approved task at the day's tier. Never the same one twice." },
      { n: "02", title: "Accept", text: "The clock starts on server time. Declining costs a heart." },
      { n: "03", title: "Prove", text: "A photo or a clip, as the task demands, straight to storage." },
      { n: "04", title: "Vote", text: "Watchers have three hours to say yes or no." },
      { n: "05", title: "Verdict", text: "A model or a person decides. The vote is evidence, not the answer." },
      { n: "06", title: "Ledger", text: "Nerve and coins move with a ledger row each. Nothing is edited." },
    ],
    notes: [
      "One task, end to end. A player holds one task at a time: asking again while an offer waits returns that offer, and asking while a clock runs is refused. The clock length is copied from the task at the draw, so editing the pool cannot move a clock already running, and the phone's own clock never matters.",
      "Declining costs a heart, before or after accepting. A clock reaching 00:00 costs a heart — a sweep checks every minute. A hand-in confirmed after the clock ran out is kept, marked rejected with the reason 'Handed in after the clock ran out', and costs the heart anyway.",
      "Every movement of Nerve and coins is written in the same transaction as the running totals: a coin ledger and a score ledger, append-only, each row with the balance after it. When a verdict is overturned, a clawback row takes back exactly what that hand-in paid and the original row stays, so a season's history is always readable.",
      "One change from the design: coins are not held in escrow between accept and verdict. A solo task costs a heart, not coins, so there is nothing to hold; a team task's penalty is charged when it fails. The only escrow in the game is a clan-war bet, where the stake row is the escrow.",
    ],
  },

  {
    id: "sides",
    kind: "two",
    section: "The game",
    theme: "dark",
    title: "Players take dares. Watchers vote and bet. Both earn coins. Nobody is both.",
    left: {
      label: "Player",
      tone: "hot",
      items: [
        "Three hearts, four hand-ins a day",
        "Earns Nerve and coins per approved task",
        "Forms a clan of two, fights clan wars",
        "On the board, findable by handle",
      ],
    },
    right: {
      label: "Watcher",
      tone: "cold",
      items: [
        "No hearts — nothing to lose",
        "Votes; a correct yes pays 2–5 coins",
        "Bets coins on clan wars",
        "Never on the board, never a search result",
      ],
    },
    notes: [
      "The role is chosen once per season and cannot be changed, and the database makes that a fact rather than a hope: one row per account per season, and asking for the other side is refused with what you already are. A player who could switch to watcher after a bad day would be voting on the field they just left.",
      "Only a watcher can vote. A player's opinion of a rival's hand-in is not evidence, and the coins the vote pays belong to the audience. Both sides spend in the same coin shop, and anyone who is not in a war can bet on it.",
      "The feed, the board, the coin shop and the wars are all readable signed out, on purpose: they are what makes someone want an account. Sharing a hand-in works signed out too. Liking and commenting (500 characters) need an account.",
      "Player search finds players only. A watcher chose the audience, and making them findable by name would turn a spectator into a search result. That is a privacy rule, not a filter.",
    ],
  },

  {
    id: "vote",
    kind: "steps",
    section: "Watchers",
    theme: "dark",
    title: "Watchers are paid for calling it right: 2 to 5 coins for a correct yes.",
    steps: [
      { n: "01", title: "Open", text: "Every hand-in goes to the watchers for three hours." },
      { n: "02", title: "Vote", text: "Yes or no, one each, changeable until the window shuts." },
      { n: "03", title: "Resolve", text: "An agent weighs the photo, the brief and the tally." },
      { n: "04", title: "Defer", text: "A clip, a doubt or an error goes to a person." },
      { n: "05", title: "Pay", text: "Approved: every correct yes earns 2–5 coins." },
      { n: "06", title: "Cool", text: "After a paid vote, five hours before another one pays." },
    ],
    notes: [
      "The window opens the moment a hand-in is confirmed and closes three hours later. One vote per watcher per hand-in, changeable while it is open; the window is re-checked inside the database write, so a vote cannot land after the resolver has claimed the hand-in.",
      "Every five minutes the vote resolver claims each hand-in whose window has closed. It looks at the photo, the task's brief and criteria, the caption, what the cheat detector said, and the tally, and answers confirmed, not confirmed, or unsure. The vote is evidence, never the answer: a landslide yes on a photo that does not show the task is not confirmed. It is told never to judge anyone's appearance, age or identity.",
      "Confirmed approves the hand-in, which pays the player and the yes-voters. Not confirmed rejects it, and nobody is paid. Unsure — and every clip, a missing API key, a refusal or an error — sends it to a person in the review queue, and nobody is paid until they settle it.",
      "What a vote pays: on an approval, every correct yes outside its cooldown earns the payout, recorded in the coin ledger. The resolver picks 2 coins for an obvious call up to 5 for a hard one; when a person settles, it is 2 on day one, 3 on day two, 5 on day three. After a paid vote a watcher earns nothing from votes for five hours — they can still vote. A no never pays, whatever the outcome; a wrong yes pays nothing.",
      "Two consequences, written down on purpose. Because a no can never earn, the rule rewards voting yes — flagged when it was set, and kept. And the list of open votes shows watchers a hand-in before anyone has reviewed it; only the public feed stays reviewed-first.",
    ],
  },

  {
    id: "wars",
    kind: "chart",
    section: "Clan wars",
    theme: "dark",
    title: "Clan wars: four hours, most Nerve wins, and a coin book the house cannot lose.",
    chart: "war-book",
    notes: [
      "Two full clans fight for four hours. The score is the Nerve their hand-ins earned, counted by when each was submitted inside the window rather than when it was approved — a clan must not lose because its best clip is at the back of the review queue. So a finished war waits in 'judging' until nothing from its window is still pending, or until 48 hours have passed.",
      "Anyone else can back a side with coins before it starts. The book is parimutuel: bettors bet against each other, the winners split the losing side's pool in proportion to what each put in, and the house takes 10% of the losing pool. The house cannot lose and nobody has to set odds. A draw, a voided war and a one-sided book — everyone backed the same clan, so there was no bet — are refunded in full.",
      "The integrity rules: nobody in either clan can bet on its war, because a member who can back the other side can be paid to lose. A flagged cheater cannot bet. The book closes when the war starts, so nobody bets knowing how it is going. One bet per person per war, topped up on the same side only. Between 1 and 500 coins. The stake leaves the balance when the bet is placed, so an unfunded bet cannot exist. Players and watchers alike can bet, and nothing in the control room lets an admin place one.",
      "Shares are whole coins, split by largest remainder, so what is paid out plus the rake always equals what was staked, exactly. The rake is frozen when the war is accepted, so a configuration change mid-war cannot move a bet already placed.",
    ],
  },

  {
    id: "exclusions",
    kind: "list",
    section: "Safety",
    theme: "dark",
    title: "Twenty-four things a task may never be. The list is the product.",
    items: [
      "Substances",
      "Weapons",
      "Theft",
      "Trespass",
      "Traffic",
      "Heights",
      "Water",
      "Fire",
      "Dangerous eating",
      "Stunts",
      "Violence",
      "Self-harm",
      "Sexual",
      "Touching",
      "Minors",
      "Confrontation",
      "Hate",
      "Deception",
      "Privacy",
      "Disruption",
      "Animals",
      "Medical",
      "Gambling",
      "Spending",
    ],
    tail: "What survives: gross-out · embarrassment · social nerve · performance · craft · observation · style.",
    notes: [
      "The tone the model is given is a dare between friends: blunt, funny, a little gross, slightly embarrassing, and completely safe. 'Eat a spoonful of dog food on camera' is the register. The animals rule forbids approaching, feeding, filming or using a live animal — not a player eating pet food.",
      "A few rules in full. Minors: nobody under 16 in frame, and anyone approached is an adult. Privacy: no homes, toilets, changing rooms, hospitals or schools, and no names, plates, addresses, phones, screens or documents. Sexual: nothing suggestive or undressed; outerwear may come off only where the brief names the items. Confrontation: a stranger ends the interaction no worse off — no pranks, insults or filming without agreement. Dangerous eating: food-safe in the amount asked, no chugging or speed challenges.",
      "Every task is checked three times: in the wording of the brief the player reads, by a deterministic screen with one rule per blocked type that runs over the brief and every criterion and fails closed, and by a reviewer agent. One list feeds the Charter, the reviewer's prompt, the screen and the report form, and a test pins that every blocked type has a screen rule of the same name.",
      "'Spending' is on the list for a commercial reason as well as a safety one. A task everyone attempts must be completable by someone who has never bought anything — that free path is how the game acquires customers rather than only rewarding the ones it already has. 'Gambling' is on it too: no bets, casinos or games for money, in any task.",
    ],
  },

  {
    id: "ai",
    kind: "points",
    section: "Safety",
    theme: "dark",
    title: "Four agents: one writes, one checks, one catches cheats, one settles votes.",
    points: [
      {
        label: "Creator · Opus 5",
        text: "Writes tasks with the Charter in context. Everything it files is a draft.",
      },
      {
        label: "Reviewer · Opus 5",
        text: "Assumes the creator was careless. Fails closed: an error is a rejection.",
      },
      {
        label: "Cheat detector · Sonnet 5",
        text: "Reads every photo hand-in. A confident cheating verdict zeroes the account.",
      },
      {
        label: "Vote resolver · Sonnet 5",
        text: "Settles a hand-in when its vote closes. Unsure goes to a person.",
      },
    ],
    foot: "The models read photos only; every clip is judged by a person. A person approves every task into the pool.",
    notes: [
      "The Charter is the rulebook the task models load: seven parts — purpose and tone, the blocked list, what is left, the guards, the shape of a brief, the three tiers, and team tasks with what a task pays. It is TypeScript rather than Markdown because the build copies only compiled code; a Markdown charter would be present in development and missing in production. It is hashed, and every generated task carries the hash of the rules that wrote it. It is sent as one cached block, so a batch pays for it once.",
      "The loop: the creator writes a batch; the screen runs, then the reviewer. A refusal from either goes back to the creator with the reason, and it is told to write a different task, not a softer version of the same one. Up to three rounds per slot; a slot that never produces an acceptable task is dropped, not filled with the least-bad attempt. Every refusal is kept with its source, feedback, round and categories. Survivors are filed as drafts; approving one re-runs the screen, and a draft the reviewer rejected cannot be approved until it is edited and reviewed again.",
      "The reviewer rejects anything illegal, harmful, a blocked type in substance, unprovable or simply very bad — and is told not to reject a task for being gross or embarrassing to the player. A refusal, an API error or an unreadable reply is a rejection, never a pass.",
      "The roadmap said no coin, heart or Nerve point would move on a model's say-so until shadow mode had agreed with staff for a full season. The owner overrode that on 11 September: the cheat detector enforces by default and the vote resolver settles hand-ins. That is an accepted product risk, with real controls — shadow and off modes, a 0.85 confidence threshold, clips always left to a person, and reinstatement in one call.",
      "Without an Anthropic API key the game degrades safely: every cheat verdict is recorded as unchecked, task generation is off, the reviewer rejects everything, and every vote waits for a person.",
    ],
  },

  {
    id: "cheating",
    kind: "points",
    section: "Safety",
    theme: "dark",
    title: "A confident cheating verdict zeroes the account, and its comments say so.",
    points: [
      {
        label: "The check",
        text: "Every photo hand-in: a screenshot, AI-made, edited, reused, staged, or not the task.",
      },
      {
        label: "The threshold",
        text: "0.85 confidence to act. Below it, the verdict is kept as suspicious for a person.",
      },
      {
        label: "The consequence",
        tone: "hot",
        text: "Watcher. Nerve, hearts and coins to zero. Every comment reads CHEATER WROTE A COMMENT.",
      },
    ],
    foot: "Modes: enforce (default), shadow, off. An admin reinstates in one call and everything comes back from the snapshot.",
    notes: [
      "The check runs off the request after a hand-in is confirmed, so the player is not kept waiting on a model. It is shown the photo with the task's brief and criteria, and names its signals: screenshot, AI-generated, edited, reused or stock, task mismatch, staged, no task context.",
      "Whatever it says is stored on the hand-in — authentic, suspicious, cheating or unchecked, with confidence, reasons, signals, the model and whether it was enforced — so the review queue shows what the model thought. A clip is recorded as unchecked with the reason 'video': the row says the model never saw it, so nobody can later claim it did.",
      "In enforce mode, a cheating verdict at 0.85 or above flags the account in one transaction: moved to watcher with status cheater, Nerve, hearts and coins set to zero with the old values kept in a snapshot and a ledger row for the coins, and the hand-in rejected with the reason. The person is told. An account already flagged is refused, so a model and a reviewer arriving together cannot both overwrite the snapshot. An admin can flag an account the same way from the panel or from a report.",
      "The label is read from the account when a comment is shown, not stamped on the comment, so a reinstated player's comments lose it. Reinstating restores Nerve, hearts and coins from the snapshot unless the admin says not to.",
    ],
  },

  {
    id: "dares",
    kind: "dares",
    section: "Tasks",
    theme: "dark",
    title: "Twenty-two dares are written. Twelve must earn a yes before any are played.",
    dares: [
      {
        n: "01",
        tier: "Day I · Qualifier",
        title: "Heavy",
        brief: "Wear every black item you own. All of it, at once. One photo, standing, head to feet.",
        kind: "Craft",
      },
      {
        n: "09",
        tier: "Day II · Nerve",
        title: "Borrowed",
        brief: "Convince a stranger to wear your jacket for thirty seconds. They have to want to.",
        kind: "Persuasion",
      },
      {
        n: "19",
        tier: "Day III · Final",
        title: "The Line",
        brief: "Ten strangers. The same three words. One after another, on camera.",
        kind: "Social nerve",
      },
    ],
    foot: "Level 0 gate: show all twenty-two to ten people. Twelve or more get a majority “yes, I would do that.”",
    notes: [
      "Season zero has 22 written dares: 8 qualifiers, 10 for day two, 4 finals. Each carries its tier, its clock, the brief, machine-readable criteria and guards. They have not yet been shown to anyone — that is the first thing the money buys.",
      "They are a document, not yet a pool. On 15 September the live task pool is empty. The 22 were written before the 24-item blocklist, the 16+ rule and the reward, proof and team fields existed, so each needs a proof type, a mode, a Nerve and coin reward, and a pass through the current screen and reviewer before it is entered and approved.",
      "Four of them take a garment variant at no design cost: 'wear every black item you own, with your [garment] on the outside'. That is the strongest link between the game and revenue, and it is also what a sponsored task looks like. One garment task per round is the right ratio; the free path must stay free.",
      "A known risk is written down: five tasks depend on Georgian speech transcription. If Georgian speech recognition is weak they need rewriting — to be tested before season one, not during it.",
    ],
  },

  {
    id: "proof",
    kind: "stats",
    section: "Proof",
    theme: "dark",
    title: "Bytes never touch the API, and the server checks every file twice.",
    stats: [
      { value: "12 MB", label: "a photo", note: "JPEG, PNG or WebP" },
      { value: "2 min", label: "a clip", note: "MP4, WebM or MOV; 5 seconds up, 40 MB cap" },
      { value: "0", label: "bytes through the API", note: "a signed URL, straight to R2" },
    ],
    foot: "No limit on hand-ins a day. At 720p and 1.5 Mbps a minute of video is about 11 MB, so a two-minute clip fits the cap with room.",
    notes: [
      "Handing in is two calls. The first names the task being handed in — it must be this player's, accepted, with time left — and declares the file's kind, type, size and length. The server checks the kind against the task's proof ('This task asks for a video.'), checks the limits, and hands out a signed URL. The browser uploads straight to storage. The second call confirms, and the same limits are checked again from the same code, so a client that lies on the first call is caught on the second.",
      "The server sees a few hundred bytes of JSON and never the video. Routing a season's uploads through the API would cost bandwidth and memory on an instance sized for JSON. The upload path is verified end to end against the live R2 bucket served at media.stiff.ge.",
      "The phone is meant to record at the bitrate the clip will be served at, so there is no transcoding stage at all — at this scale a transcoding service would have cost about $29 a season for a file the phone could simply have produced correctly. That is a rule for the player app; the server's part of it is the 2-minute and 40 MB caps.",
      "A hand-in moves from awaiting upload to submitted to published or rejected, and only a verdict publishes. A caption can be up to 280 characters. Proving a recording is fresh with a challenge word shown at a server-chosen second is designed and not built.",
    ],
  },

  /* ============================================== III · THE RULEBOOK === */

  {
    id: "plate-rulebook",
    kind: "plate",
    section: "The rulebook",
    theme: "dark",
    title: "Rules",
    plate: "0049",
    chapter: "III · The rulebook",
    caption: "Every rule the server enforces, with its number. The deck leaves these pages out; the journal keeps them.",
    journalOnly: true,
    notes: [
      "The rulebook is written from backend/src/game on main: rules.ts and media-rules.ts for the numbers, the Charter and the blocklist for the tasks, report-rules.ts for reports, and the services for what actually happens. Where a rule can be tuned from the environment, its default is given; the default is the rule as designed.",
    ],
  },

  {
    id: "rulebook",
    kind: "table",
    section: "Rulebook",
    theme: "dark",
    journalOnly: true,
    title: "The whole game on one page. Every number here is a constant in the server.",
    columns: ["Rule", "Value"],
    rows: [
      { cells: ["Minimum age", "16, for players and watchers alike"] },
      { cells: ["Season", "3 days; the day is the task tier"] },
      { cells: ["Hearts", "3 per player per season; only ever go down"] },
      { cells: ["Task clock", "15, 20 or 25 minutes, by day"] },
      { cells: ["Daily minimum", "4 hand-ins per Tbilisi day; no maximum"] },
      { cells: ["Photo", "JPEG, PNG or WebP, up to 12 MB"] },
      { cells: ["Clip", "MP4, WebM or MOV, 5 seconds to 2 minutes, up to 40 MB"] },
      { cells: ["Task reward", "5–100 Nerve and 1–20 coins, to each person who did it"] },
      { cells: ["Team penalty", "1–3 coins from each member"] },
      { cells: ["Clan", "exactly 2 players; locked once full"] },
      { cells: ["Voting window", "3 hours after a hand-in"] },
      { cells: ["Correct yes", "2–5 coins; then 5 hours before another pays"] },
      { cells: ["Clan war", "4 hours, scheduled 30 minutes to 7 days ahead"] },
      { cells: ["War bet", "1–500 coins a person; house keeps 10% of the losing pool"] },
      { cells: ["Cheating", "acted on at 0.85 confidence; everything to zero"] },
      { cells: ["Reports", "20 a day per account; 5 accounts hide a hand-in"] },
      { cells: ["Elimination by rank", "never"], strong: true },
    ],
    notes: [
      "GET /api/game/rules returns the minimum age, the daily minimum, starting hearts, what costs a heart, the clan size, eliminationByRank: false, the tie-break, the team penalty range and the voting rules — from the same constants the services use, so a client never hard-codes one. 'It said four' has one answer, whichever instance is asked.",
      "The reward bounds are the ones the task-writing model is held to by the schema its reply is forced into, and the task is clamped again when it is filed. The database itself only requires rewards to be zero or more, and holds the team penalty at 1 to 3 with a CHECK constraint, so no writer can file a task that costs a clan ten.",
      "Operational rules can be tuned from the environment without a deploy — the daily minimum, the cheat detector's mode and threshold, the war rake and maximum stake, the report thresholds. Product rules cannot: the age, the clan size, the vote window, payout and cooldown, the war's length and lead times need a code change, on purpose.",
    ],
  },

  {
    id: "joining",
    kind: "points",
    section: "Rulebook · Joining",
    theme: "dark",
    journalOnly: true,
    title: "Joining asks for four things: a name, a password, a side and a birthday.",
    points: [
      {
        label: "Sign-up",
        text: "Username of 3–24 letters, numbers or underscores; password of 8–72 characters; player or watcher; date of birth. Email is optional.",
      },
      {
        label: "16 and over",
        text: "Under sixteen is refused before an account exists. The date is recorded before it is judged, so a new year cannot be tried.",
      },
      {
        label: "One account",
        text: "A game account is an ordinary shop account: one login for stiff.ge and stiff.co.",
      },
      {
        label: "Any day",
        text: "A live season takes a newcomer on any of its days, at zero Nerve with full hearts.",
      },
    ],
    notes: [
      "There is no phone number, no IP check and no device fingerprint — the game asks for the least it can. The owner set that on 11 September; the roadmap's Level 2 still lists phone verification and 18+, and is out of date on both.",
      "The age is checked twice: at sign-up, before the account is made, so a refusal leaves nothing behind; and every time an account takes a side. A shop account made on stiff.ge has no date of birth, so its first enrolment must carry one; once one is recorded, a different one is ignored. Under sixteen is 'You must be 16 or older to take part'. A malformed date, an impossible one like 30 February, a future date or an age over 120 is refused as a mistake rather than as an age.",
      "The side is chosen once per season. Asking for the other side is refused, naming what you already are — or, for a demoted player, why they were moved. Between seasons the account is still made and the chosen side is kept until a season opens.",
      "An account without an email gets no verification mail and no password reset until it adds one. Sign-up is throttled to five attempts a minute.",
    ],
  },

  {
    id: "hearts",
    kind: "table",
    section: "Rulebook · Hearts",
    theme: "dark",
    journalOnly: true,
    title: "Three hearts. A few things burn one, and none of them come back.",
    columns: ["What happened", "Solo task", "Team task, to each member"],
    rows: [
      { cells: ["Declined, before or after accepting", "−1 heart", "−1 heart and −1 to −3 coins"] },
      { cells: ["The clock reached 00:00", "−1 heart", "−1 heart and −1 to −3 coins"] },
      { cells: ["Handed in after the clock", "rejected, −1 heart", "rejected, −1 heart and −1 to −3 coins"] },
      { cells: ["Hand-in rejected at the verdict", "nothing", "−1 to −3 coins"] },
      { cells: ["A reviewer burns a heart when settling", "−1 heart", "−1 heart, to the one who handed in"] },
      { cells: ["The last heart burns", "watcher, at once", "watcher, at once"], strong: true },
    ],
    notes: [
      "The coin penalty is the task's own figure, 1 to 3, and coins floor at zero: a three-coin penalty on a one-coin balance takes one, and the ledger records one. A rejected hand-in on a solo task costs nothing but the Nerve it did not earn.",
      "The last heart makes the player a watcher in the same call, whichever of these burned it, and they are told. A demoted-for-hearts player asking a player's route is refused with 'You lost your last heart'. Their Nerve stays on the record; they leave the board. Only an admin can put them back.",
      "Hearts only ever go down inside a season — the design calls a burned heart ash — and the floor at zero is written into the database statement rather than corrected afterwards. The design once linked hearts to coins, burning one only when a penalty exceeded a player's earned coins; that was not built. Hearts and coins are separate.",
    ],
  },

  {
    id: "demotions",
    kind: "list",
    section: "Rulebook · Demotion",
    theme: "dark",
    journalOnly: true,
    title: "Four ways a player becomes a watcher. A rank is not one of them.",
    items: [
      "Out of hearts — the last one burns, and the move happens in the same call",
      "Under the daily minimum — fewer than 4 hand-ins in a Tbilisi day, swept at 00:05",
      "Broke on every count — 0 Nerve, 0 hearts and 0 coins, swept at 00:10",
      "Caught cheating — a confident model verdict, or an admin; everything to zero",
    ],
    tail: "Only an admin moves a player back. Nothing moves anyone for where they placed.",
    notes: [
      "The daily minimum counts hand-ins that were submitted or published, by the moment each was confirmed, inside the whole Tbilisi day. One waiting for a verdict counts; a rejected one does not; an upload that was never finished never does. It judges active players enrolled before the day began, and only when the season was running for the whole day — a season that opened at noon has not given anyone a whole day. GET /api/game/me shows a player 'handed in today' against the minimum, the same count the sweep will make, so nobody finds out at midnight.",
      "A daily-minimum demotion keeps Nerve and hearts; the player leaves the board with their score on the record, and their own board view says why they vanished. The zero-balance sweep only ever catches someone who has lost every heart, so it never touches a player who just joined.",
      "Every demotion stores the new status, the reason, the time, and a snapshot of Nerve, hearts, coins and the hand-in at that moment. A database CHECK holds that an active row has no reason and a demoted one has one. A demoted player asking for a player's route is refused with the reason spelled out.",
      "Both sweeps run once across all API instances under a leader lock, tell each person what happened, and log a failure rather than letting it reach the scheduler. An admin can run them on demand. The day boundary is Tbilisi's: a hand-in at 23:30 local counts for the day the player thinks it is.",
    ],
  },

  {
    id: "board",
    kind: "points",
    section: "Rulebook · The board",
    theme: "dark",
    journalOnly: true,
    title: "Nerve is the score. Every point of it has a row saying who moved it and why.",
    points: [
      {
        label: "Earned",
        text: "Paid when a hand-in is approved: the task's reward, or a reviewer's figure on a solo hand-in.",
      },
      {
        label: "Never bought",
        text: "Never spent, never bet, never negative. No amount of coins touches it.",
      },
      {
        label: "Ties",
        text: "Equal Nerve breaks on who reached it first. A clawback does not make anyone newer.",
      },
      {
        label: "Ranked, never cut",
        text: "Players only, highest first. A rank is a standing, not a sentence.",
      },
    ],
    notes: [
      "Every change to Nerve is a row in the score ledger, written in the same transaction as the score, so a player's Nerve is always the sum of their rows. The reasons are: task reward (an approved hand-in, naming the admin or the resolver); clawback (a hand-in taken out of the feed gives back exactly the net it paid — a second call finds nothing left); cheating (zeroed, by the model or an admin); reinstated (what a reinstatement actually put back); admin (a correction of up to ±10,000 with a written reason); and opening, written once for Nerve that existed before the ledger.",
      "A negative movement floors at zero, and the ledger records what actually moved, not what was asked. The time a score was last reached moves only when Nerve goes up, because the board breaks ties on who reached a score first.",
      "The board is public, 100 rows a page at most, ordered by Nerve, then by who reached it first, then by handle. A rank is one more than the number of players ahead by the same rule, so a player's rank on their dashboard and on the board can never disagree. A signed-in player's own view shows their rank, the total, and the three rows either side for context — not to show how close anyone is to being dropped, because nobody is.",
      "A watcher is never on the board. A player moved to watcher drops off it with their Nerve intact, and their own view says so, with the reason, rather than leaving them to guess why they vanished.",
    ],
  },

  {
    id: "clans",
    kind: "points",
    section: "Rulebook · Clans",
    theme: "dark",
    journalOnly: true,
    title: "A clan is exactly two players. Its tasks pay both and cost both.",
    points: [
      {
        label: "Forming",
        text: "A player names a clan (3–24 characters, unique in the season) and gets an invite code. The second joins with it.",
      },
      {
        label: "Locked",
        text: "One clan per person. Once full, nobody leaves for the season. While forming, the leader leaving disbands it.",
      },
      {
        label: "Team tasks",
        text: "Only the leader draws, accepts and declines. Either member may hand in; the footage must show both.",
      },
      {
        label: "Paid and charged",
        text: "Approved: both get the full reward. Failed: each loses 1–3 coins, and a decline or expiry burns a heart each.",
      },
    ],
    notes: [
      "The database makes two the most a clan can hold: one leader seat and one member seat per clan, and one seat per person per season. Two people joining at the same moment cannot both take the member seat. The clan goes from forming to full, and a full clan is locked because its tasks pay and charge both — a walk-out would leave the other holding the score alone.",
      "A team task is written so both people are visibly doing the dare in the same footage, not one filming the other; a team task one person could do alone is a solo task with a spectator. It is drawn only by a full clan's leader, who cannot hold a solo task and a clan task at once.",
      "A clan hand-in counts toward the daily minimum of the member who uploaded it, not both — each member still needs four of their own. On a clan hand-in the task decides the reward; a reviewer's own Nerve figure is ignored.",
      "A clan's view shows both members' handle, Nerve, coins and hearts. The invite code is shown only to its members, and only while it is still forming. Full clans can challenge each other to wars.",
    ],
  },

  {
    id: "war-states",
    kind: "table",
    section: "Rulebook · Clan wars",
    theme: "dark",
    journalOnly: true,
    title: "A war moves through six states, and every move locks its rows.",
    columns: ["State", "What it means", "How it moves on"],
    rows: [
      { cells: ["Proposed", "a leader challenged another full clan", "accepted, declined, or void if unanswered by the start"] },
      { cells: ["Accepted", "both agreed; the book is open and the rake frozen", "live, at the start time"] },
      { cells: ["Live", "the four hours are running; no more bets", "judging, at the end"] },
      { cells: ["Judging", "waiting for the window's hand-ins to be judged", "settled when none are pending, or after 48 hours"] },
      { cells: ["Settled", "scored and paid out", "—"], strong: true },
      { cells: ["Void", "called off; every stake refunded", "—"] },
    ],
    notes: [
      "A war can only be started while a season is running, between two full clans, and a clan can be in only one war that is not over. It is scheduled from 30 minutes to 7 days ahead — an hour by default — so there is time to bet. The challenger can withdraw before it starts, and the book is refunded.",
      "A clock runs every minute: it starts wars, ends them, settles judged ones and voids challenges nobody answered. Proposing and accepting lock both clans in a fixed order; a bet locks the war; settling locks the war and its bets. A scheduled tick and an admin pressing settle at the same moment cannot both pay.",
      "The coin ledger names three movements: a war stake (out), a war payout (back with winnings) and a war refund (back, nothing won). The rake is recorded on the war itself, not against any person. It is 10% of the losing pool by default and can be set from 0 to 50; the maximum stake is 500 by default.",
      "The public view of a war shows both pools, how many people bet and what one coin on each side would return if it ended now — never who bet. Bets are throttled to twenty a minute. From the panel an admin can set two clans a war directly, settle a stuck one or void one with a reason, and everyone is refunded and told why.",
    ],
  },

  {
    id: "coin-shop",
    kind: "points",
    section: "Rulebook · Coin shop",
    theme: "dark",
    journalOnly: true,
    title: "The coin shop sells what an admin lists, at the price an admin sets.",
    points: [
      {
        label: "Listing",
        text: "A name, a picture, a price in coins, a stock (blank is unlimited) and a limit per person. A draft until set live.",
      },
      {
        label: "Buying",
        text: "Players and watchers alike. The limit, the stock and the balance are checked in one transaction.",
      },
      {
        label: "Refused",
        text: "“Sold out.” “You can only buy this N times.” “Not enough coins.” Nothing half-happens.",
      },
      {
        label: "After",
        text: "An admin marks it handed over, or cancels it and the coins and stock go back.",
      },
    ],
    notes: [
      "Nothing is listed yet. On 15 September the live database has no shop items and no purchases, so there are no coin prices to quote: every price will be a number an admin types. The panel caps a price and a stock at 1,000,000 and a per-person limit at 1,000.",
      "What it is for: merch, a skin, a place at the final — whatever the season offers. It is not the clothing shop, which sells in lari; this sells for the coins the game mints.",
      "The price is copied onto the purchase, so repricing an item later does not reprice what was already bought. The shop is readable signed out, showing each live item's price, stock and whether it is sold out, because it is a reason to want an account; signed in, it also shows how many of each the reader already has.",
      "The charge refuses rather than floors: a purchase on a balance that cannot cover it is not a purchase, and two purchases racing for the last coins cannot both succeed. A refused charge rolls the stock back with it. A cancelled purchase refunds through the ledger and cannot be changed again.",
    ],
  },

  {
    id: "reports",
    kind: "stats",
    section: "Rulebook · Reports",
    theme: "dark",
    journalOnly: true,
    title: "Anyone can report almost anything. Five accounts hide it before a person looks.",
    stats: [
      { value: "8", label: "kinds of thing", note: "hand-ins, comments, people, tasks, shop items, clans, purchases, the game" },
      { value: "37", label: "reasons", note: "each with a priority, from low to critical" },
      { value: "5", label: "to hide it", note: "different accounts, on a hand-in or a comment" },
      { value: "20", label: "reports a day", note: "the most one account may file" },
    ],
    notes: [
      "Critical reports — self-harm, violence, a threat, illegal activity, someone under 16, a way to cheat the game — go to the top of the queue, which is sorted by priority and then by age. Each kind of thing offers only its own reasons, in menu order. Some are appeals about one's own thing ('the verdict on my hand-in is wrong', 'I was moved to watcher unfairly'); 'cheating' is only about somebody else; a purchase can only be reported by its buyer; and one's own comment cannot be reported at all — delete it instead. A dangerous or illegal report can name up to six blocked task types.",
      "What is refused: a reason that thing does not offer; a second open report on the same thing from the same account; anything the reporter could not have seen, which is answered as not found rather than as a hint; and a twenty-first report in a day.",
      "Once five different accounts have an open report on the same hand-in or comment, it is hidden from the feed without waiting for anyone, and those reports are raised in priority. Nothing else moves — the verdict, the Nerve and the counts stand until an admin decides.",
      "An admin claims a report, then closes it as resolved with an action or dismissed with none. The eight actions are: none, remove the content, restore it, warn the person, flag a cheater, reinstate (an upheld appeal), retire the task, and archive the shop item. The action runs first, through the service that owns it, and a refusal keeps the report open. Closing one closes every open report on the same thing. Every reporter is told the outcome; the admin's internal note never leaves the panel. Reports are never deleted, so a pattern of bad-faith reports is visible.",
    ],
  },

  {
    id: "task-anatomy",
    kind: "table",
    section: "Rulebook · Tasks",
    theme: "dark",
    journalOnly: true,
    title: "What every task carries, and the bounds on each field.",
    columns: ["Field", "Values"],
    rows: [
      { cells: ["Tier", "1, 2 or 3 — the day it is drawn on"] },
      { cells: ["Clock", "15, 20 or 25 minutes, copied when drawn"] },
      { cells: ["Proof", "photo, video or either; stated in the brief's last line"] },
      { cells: ["Mode", "solo, or team for a clan's leader to draw"] },
      { cells: ["Reward", "5–100 Nerve and 1–20 coins to each person"] },
      { cells: ["Penalty", "1, 2 or 3 coins from each member of a failed team"] },
      { cells: ["Guards", "adults only · no contact · outerwear only · no obstruction · consent on record · own wardrobe"] },
      { cells: ["Criteria", "visual · temporal · interaction · audio · scene · liveness"] },
      { cells: ["Charter hash", "which version of the safety rules wrote it"] },
      { cells: ["Status", "draft → approved → retired; only a person approves"], strong: true },
    ],
    notes: [
      "Anything that involves eating, speaking, performing or another person is a video; something that can be shown finished can be a photo. An upload of the wrong kind is refused before any upload URL is made: 'This task asks for a video.' or 'This task asks for a photo.'",
      "Guards are enforced twice: in the brief the player reads, and by the screen. Every task involving another person must state 'adults only' — the Charter calls leaving it out the single most common mistake in the game. Criteria are what a verifier checks: one assertion each, true or false from the footage alone, never a judgement of quality or effort. Every task should carry one that footage recorded before the round could not satisfy — usually liveness, a server-issued word or colour at a timestamp.",
      "The pool is shared across seasons, because a task that worked is worth running again. A draw picks at random from approved tasks at the day's tier that this player has not been offered before this season, and the database refuses a repeat. Nothing left for them is a clear refusal, not a recycled task.",
      "On 15 September the live pool is empty — no tasks of any status. Generation runs from the panel: pick a tier, a count, optionally solo or team and a steer, and the pool's existing tasks are passed along so they are not rewritten.",
    ],
  },

  {
    id: "control-room",
    kind: "table",
    section: "Rulebook · Control room",
    theme: "dark",
    journalOnly: true,
    title: "The game runs from admin.stiff.co: thirteen screens, and no psql.",
    columns: ["Screen", "For"],
    rows: [
      { cells: ["Overview", "the season, its counts, and what needs a person now"], strong: true },
      { cells: ["Review", "hand-ins waiting on a verdict, with what the model thought"] },
      { cells: ["Votes", "open votes, and deferred ones waiting on a person"] },
      { cells: ["Reports", "claim, prioritise, resolve, reopen"] },
      { cells: ["Clocks", "held tasks and running timers, counting down live"] },
      { cells: ["Hand-ins", "every photo and clip; take one down, hide a comment"] },
      { cells: ["Players", "score and coin ledgers, corrections, flag, reinstate"] },
      { cells: ["Clans", "both seats, combined Nerve, record; organise a war"] },
      { cells: ["Clan wars", "every war and its book; settle, or void and refund"] },
      { cells: ["Board", "the ranking and player search"] },
      { cells: ["Seasons", "draft, open, running, closed"] },
      { cells: ["Tasks", "the pool, the two-agent generator, refusal rates"] },
      { cells: ["Coin shop", "items and purchases"] },
    ],
    notes: [
      "The panel is its own Next.js app on its own branch and domain, deliberately separate from the shop's panel: an operator running a season at midnight should not be one mis-click from editing a product. It signs in with the same admin account — an ordinary shop account with the admin role — and holds its own session.",
      "Three levers deserve care, and each goes through the path that already exists for it. Coin corrections: coins will be bought with real money, so a correction is bounded at ±100,000, needs a reason, floors at zero and names the admin in the ledger. Organising a war: it skips the challenge and opens the book at once — until the player app exists, it is the only way a war starts. Hiding a comment: never deleting, so a wrong call can be undone.",
      "The game's API has 44 admin routes and 46 for players and watchers. Every state-changing admin request lands in the audit log. Nothing in the panel lets an admin bet: someone who can see every pool and settle every war has no business holding a stake in one.",
    ],
  },

  {
    id: "schedule",
    kind: "table",
    section: "Rulebook · Clocks",
    theme: "dark",
    journalOnly: true,
    title: "Five clocks run the game without anyone pressing a button.",
    columns: ["Job", "When", "What it does"],
    rows: [
      { cells: ["Task clock", "every minute", "expires overdue tasks: a heart each, and a clan's coin penalty"] },
      { cells: ["War clock", "every minute", "starts, ends and settles wars; voids unanswered challenges"] },
      { cells: ["Vote resolver", "every 5 minutes", "settles every hand-in whose 3-hour vote has closed"] },
      { cells: ["Daily minimum", "00:05 Tbilisi", "moves players under 4 hand-ins yesterday to watcher"] },
      { cells: ["Zero balance", "00:10 Tbilisi", "moves players at 0 Nerve, 0 hearts, 0 coins to watcher"] },
    ],
    notes: [
      "Every job runs under a leader lock, so with several API instances each one runs once. A failure is logged rather than allowed to reach the scheduler. Each has a button in the panel for running it now: the discipline sweeps, vote resolution and the war clock.",
      "The game's day is Tbilisi's (UTC+4) rather than the server's. The shop runs six scheduled jobs of its own on the same instances: opening scheduled drops, abandoned-cart reminders, the nightly analytics snapshot, and clearing stale tokens, guest carts and unverified accounts.",
    ],
  },

  {
    id: "config",
    kind: "table",
    section: "Rulebook · Settings",
    theme: "dark",
    journalOnly: true,
    title: "Every rule an operator can turn without a deploy, and its default.",
    columns: ["Setting", "Default", "What it turns"],
    rows: [
      { cells: ["GAME_DAILY_MINIMUM_TASKS", "4", "hand-ins a day to stay a player; 0 turns the sweep off"] },
      { cells: ["GAME_CHEAT_DETECTION", "enforce", "enforce, shadow (store only) or off"] },
      { cells: ["GAME_CHEAT_CONFIDENCE", "0.85", "how sure the model must be to act"] },
      { cells: ["GAME_WAR_RAKE_PERCENT", "10", "the house's share of a losing pool, 0–50"] },
      { cells: ["GAME_WAR_MAX_STAKE", "500", "coins one person may put on one war"] },
      { cells: ["GAME_REPORT_AUTO_HIDE", "5", "accounts before a hand-in or comment is hidden; 0 off"] },
      { cells: ["GAME_REPORT_DAILY_CAP", "20", "reports one account may file in a day"] },
      { cells: ["GAME_TASK_MAX_ROUNDS", "3", "creator and reviewer rounds per task, 1–10"] },
      { cells: ["GAME_TASK_REVIEWER_MODEL", "claude-opus-5", "the task reviewer"] },
      { cells: ["GAME_CHEAT_MODEL", "claude-sonnet-5", "the cheat detector"] },
      { cells: ["GAME_VOTE_RESOLVER_MODEL", "claude-sonnet-5", "the vote resolver"] },
      { cells: ["ANTHROPIC_API_KEY", "—", "without it: nothing checked, nothing generated, every vote to a person"], strong: true },
    ],
    notes: [
      "Anything unreadable falls back to the default, and the default is the rule as designed. The creator agent's model is fixed in code at claude-opus-5.",
      "Deliberately not settings: the minimum age, the clan size, the three-hour vote window, the 2–5 coin payout and five-hour cooldown, the four-hour war with its 30-minute to 7-day lead and 48-hour judging deadline, and the 1–3 coin penalty. Each is a constant, so changing one is a reviewed code change. A season's starting hearts are stored on the season, 3 by default.",
    ],
  },

  /* =================================================== IV · THE MONEY === */

  {
    id: "economy",
    kind: "two",
    section: "Economy",
    theme: "light",
    title: "Coins are earned, spent and bet. Nerve is only earned. That stops pay-to-win.",
    left: {
      label: "Coins",
      items: [
        "In: approved tasks, correct votes, won bets",
        "Out: the coin shop, war stakes, team penalties",
        "An append-only ledger; balance after every row",
        "Floors at zero; a reversal is a new row",
      ],
    },
    right: {
      label: "Nerve",
      items: [
        "The score — the only thing the board reads",
        "Never bought, never spent, never bet",
        "Decides every clan war; coins never do",
        "Ties break on who got there first",
      ],
    },
    foot: "Hearts are a third thing: three a season, never bought, never returned.",
    notes: [
      "The coin ledger names every reason a coin moves: task reward, task penalty, vote reward, purchase, war stake, war payout, war refund, cheating (zeroed), reinstated, and admin (a correction or a cancelled purchase). The running total on each player is written in the same transaction as the row, so it can always be checked against the sum of the ledger. No endpoint edits or deletes a row.",
      "Owner decision on record: coins are both earned and purchasable, and purchases will reuse the shop's TBC and Bank of Georgia card providers rather than a new one. That purchase path is not built. On 15 September no code sells coins for money; coins enter the game only through play, votes, won bets, reinstatement and admin corrections.",
      "No column anywhere holds money, and there is no transfer of coins between people. The war rake takes coins out of circulation: it is a sink that holds the currency's value, not revenue.",
    ],
  },

  {
    id: "earnings",
    kind: "table",
    section: "The money",
    theme: "light",
    title: "What every move pays and what it costs, as the server enforces it.",
    columns: ["Move", "Pays", "Costs"],
    rows: [
      { cells: ["Solo task approved", "5–100 Nerve and 1–20 coins", "—"], strong: true },
      { cells: ["Team task approved", "the same, to both members", "—"] },
      { cells: ["Task declined or timed out", "—", "1 heart; a team also 1–3 coins each"] },
      { cells: ["Team hand-in rejected", "—", "1–3 coins each"] },
      { cells: ["Correct yes vote", "2–5 coins, once per 5 hours", "—"] },
      { cells: ["No vote, or a wrong yes", "nothing", "—"] },
      { cells: ["Winning war bet", "stake + share of 90% of the losing pool", "—"] },
      { cells: ["Losing war bet", "—", "the stake, 1–500 coins"] },
      { cells: ["Draw, void or one-sided war", "stake back", "—"] },
      { cells: ["Coin shop", "the item", "whatever the admin priced it"] },
      { cells: ["Caught cheating", "—", "all Nerve, hearts and coins"] },
    ],
    notes: [
      "Task rewards are the bounds the task-writing model is held to, around a guideline of 10, 25 and 50 Nerve by day. A person settling a solo hand-in may pay a different Nerve figure; a clan hand-in always pays what the task says.",
      "Vote payouts: the resolver picks 2 coins for an obvious call up to 5 for a hard one; a person settling pays the day's default of 2, 3 or 5. A watcher can still vote during the five-hour cooldown; they just do not earn from it.",
      "There is no price list yet, and this page does not pretend otherwise: the task pool and the coin shop are both empty in the live database, so every figure is a rule's range rather than a price.",
    ],
  },

  {
    id: "ceilings",
    kind: "stats",
    section: "The money",
    theme: "light",
    journalOnly: true,
    title: "What the rules allow at the edges. Arithmetic, not measurement.",
    stats: [
      { value: "25", label: "coins a day", note: "the most a watcher can earn by voting" },
      { value: "75", label: "coins a season", note: "the same ceiling over three days" },
      { value: "340", label: "Nerve", note: "the minimum four a day, all approved at the guideline" },
      { value: "500", label: "coins on one war", note: "the most one person can stake" },
    ],
    foot: "DERIVED from the constants in rules.ts and the Charter's guideline rewards. No season has been played.",
    notes: [
      "A watcher: a paid vote starts a five-hour cooldown, so in any 24 hours at most five votes can pay — at hours 0, 5, 10, 15 and 20. At the 5-coin maximum that is 25 coins a day; if every paid call is an obvious one at 2 coins, 10. Over a three-day, 72-hour season, at most fifteen paid votes: 30 to 75 coins. It assumes there is always a hand-in to call right, and it counts from when each vote is paid, which is when the hand-in is settled.",
      "A player doing exactly the minimum — four hand-ins a day, all approved at the Charter's guideline — earns 4 × 10 on day one, 4 × 25 on day two and 4 × 50 on day three: 340 Nerve. The twelve tasks pay between 12 and 240 coins at the 1–20 bounds. There is no maximum: every extra approved hand-in pays again.",
      "A clan task pays its full reward to both members, so one approved team hand-in puts twice the Nerve and coins into the game that a solo one does.",
      "A war bet returns 1 + 0.9 × (losing pool ÷ winning pool) for every coin on the winning side. Back a side alone with 10 coins against 400 on the other, and a win returns 10 + 360 = 370; back the favourite with 400 against 10 and a win returns 409. The house keeps 10% of the losing pool whichever way it goes.",
    ],
  },

  {
    id: "never-money",
    kind: "statement",
    section: "The money",
    theme: "light",
    title: "Coins will be sold for lari. Nothing will ever turn them back into lari.",
    body: [
      "No cash-out, no transfer between people, no column that holds money.",
      "A bet is coins against coins, and the house takes coins.",
    ],
    notes: [
      "Clan-war betting was asked for with real money and built with coins only, and the reason is written into the code. A book on real money is a licensed gambling operation in Georgia. The game admits sixteen-year-olds. And the TBC and Bank of Georgia merchant agreements that carry the shop's card payments do not cover gambling, so running bets over them would put the clothing shop's payments at risk along with everything else.",
      "Coins can be bought, which is exactly why nothing may convert them back: buy-in, wager and cash-out together is the shape a regulator looks for. The missing third piece is permanent, not a gap left for later. The blocklist forbids gambling as a task for the same reason.",
      "What this leaves for legal advice is on the use-of-funds list: selling coins to sixteen-year-olds, and how prizes are given.",
    ],
  },

  {
    id: "r2",
    kind: "chart",
    section: "The money",
    theme: "light",
    title: "A viral season costs $2 to serve on R2. On AWS, $344.",
    chart: "r2-vs-aws",
    notes: [
      "What a season's clips cost to serve depends entirely on how many people watch them, so the hosting note prices three worlds: light (20 views a clip, 268 GB out), medium (60 views, 805 GB) and viral (300 views, 4 TB).",
      "Storage, operations and requests are cents on either provider. The entire difference is egress — what it costs to hand a file back to someone watching. AWS charges $0.085 a gigabyte; R2 charges nothing.",
      "Do not split them: S3 for storage with a CDN in front is billed on the way out of S3 before the CDN ever sees the byte. R2 end to end, or AWS end to end. Signed uploads work identically on both, so the choice is reversible if latency measured on Georgian networks says otherwise.",
      "These volumes come from the hosting note, which sized a season with the old cut lines — about 1,220 published clips. Under the rules enforced now, the minimum is roughly ten times as many hand-ins (the journal's next page does the arithmetic). The conclusion gets stronger, not weaker: the more that is served, the more the zero-egress line is worth.",
    ],
  },

  {
    id: "media-now",
    kind: "table",
    section: "The money",
    theme: "light",
    journalOnly: true,
    title: "Media under today's rules: four hand-ins a day, and nobody cut.",
    columns: ["If every hand-in is…", "Uploaded", "R2 storage a month"],
    rows: [
      { cells: ["a photo, about 400 KB", "≈ 4.8 GB", "≈ $0.07"] },
      { cells: ["half photos, half one-minute clips", "≈ 68 GB", "≈ $1.03"], strong: true },
      { cells: ["a clip at the 2-minute limit, 22 MB", "≈ 264 GB", "≈ $3.96"] },
      { cells: ["a clip at the 40 MB cap", "≈ 480 GB", "≈ $7.20"] },
    ],
    foot: "DERIVED: 1,000 players × 4 hand-ins × 3 days = 12,000 hand-ins. R2 storage at $0.015 a GB-month; R2 egress is $0.",
    notes: [
      "The hosting note's 13.4 GB came from a field cut from 1,000 to 200 to 20. With no cuts and a minimum of four a day, a thousand players who stay players hand in at least 12,000 times over three days — and more if they want, because there is no maximum. The per-file sizes are the note's own: a client-resized photo of about 400 KB, 11 MB for a minute of 720p video.",
      "Storage stays trivial on R2 even at the worst case, and serving it still costs nothing in egress. The budget risk moves from media to people and models. Every photo hand-in is two model calls — the cheat detector when it is confirmed, the vote resolver when its window closes — and every clip goes to a person, because the models read photos only.",
      "That makes two of season one's six numbers the ones to watch first: cost per verified attempt, and the depth of the review queue.",
    ],
  },

  {
    id: "revenue",
    kind: "chart",
    section: "The money",
    theme: "light",
    title: "Four revenue sources, in the order they become available.",
    chart: "revenue-split",
    notes: [
      "This is the one projected page. Season one has not run, so the split is a planning assumption, not a measurement, and it is stamped as such.",
      "None of the four is live today. Coin bundles and the season pass are decided and not built; sponsorship needs an audience that does not exist yet; the shop serves a holding page until the game launches. The war rake is not on this chart because it is paid in coins, and coins never become money.",
      "Coin bundles will be sold by card through the acquirers the shop already has. The season pass is sold before a season opens. Sponsorship is last because it is the only source that requires an audience you already have — sponsors buy proven reach, and there is none until season one has been filmed. The garment-variant task is the natural sponsored shape.",
      "The shop is the smallest slice and the one that matters: the game exists to turn watchers and players into customers. Budget for a camera operator at the final even when nothing is sponsored — the tape is what sells season two.",
    ],
  },

  {
    id: "payments",
    kind: "points",
    section: "Payments",
    theme: "light",
    title: "Payments run on rails the shop already has: TBC, BOG, bank transfer, cash on delivery.",
    points: [
      {
        label: "Card · TBC / BOG",
        text: "Hosted payment page and a signed callback. Test mode walks the whole flow today; live on merchant credentials.",
      },
      {
        label: "Bank transfer",
        text: "Instructions with an order reference. A person confirms the money landed.",
      },
      {
        label: "Cash on delivery",
        text: "Always available. The courier collects; the order is marked paid on delivery.",
      },
    ],
    foot: "One service owns “what makes an order paid”. Coin bundles are meant to go through it — no new provider, and not built yet.",
    notes: [
      "Card is split by acquirer rather than offered as one button because in Georgia the shop holds a merchant account with a specific bank, and which one is live depends on which contract exists. Either, both or neither can be configured; checkout only offers what is usable and shows the rest as coming soon.",
      "Providers never write order status themselves. They report what happened and one payments service owns the transition, so the rule for what makes an order paid lives in one place across four integrations.",
      "The live bank integration deliberately refuses until credentials exist, rather than shipping code written blind against a bank API. Everything around it — availability, method selection, the redirect contract, the callback route, the order transition — is real and exercised in test mode. Stripe and PayPal are deliberately absent.",
      "Coin bundles are card-only by decision: cash on delivery and bank transfer do not suit an instant digital good.",
    ],
  },

  {
    id: "cost",
    kind: "chart",
    section: "The money",
    theme: "light",
    title: "The whole operation runs under a $750 ceiling. A season month is $267.",
    chart: "monthly-bill",
    notes: [
      "Steady state — shop live, no season — is about $131 a month: Vercel Pro, a Render Pro workspace with one Standard instance, Supabase Pro on small compute, Cloudflare with R2, Upstash Redis and Resend.",
      "A season month with a thousand players and medium viewing is about $267. The step up is a larger Render instance for the clocks and the review queue and a larger Postgres — not for media, because uploads bypass the API entirely.",
      "Running the AI adds $50 to $250, which is genuinely unknown until a season runs. Ceiling case about $520; headroom against $750 about $230. These were sized before the daily minimum and the four model roles existed: under today's rules every photo hand-in is two model calls, so the AI line is the one to measure, not the storage line.",
      "Four things would break the budget, and each is a decision rather than a surprise: serving video through the app instead of R2, staying on Cloudinary, choosing AWS for media and then going viral, or leaving database compute scaled up after a season ends.",
    ],
  },

  /* ==================================================== V · THE PLAN === */

  {
    id: "roadmap",
    kind: "roadmap",
    section: "The plan",
    theme: "light",
    title: "The game's server and control room are built. The player app is next.",
    levels: [
      {
        n: "0",
        name: "Prove the premise",
        weeks: "1",
        status: "partial",
        state: "22 dares written; not shown to anyone, not in the pool",
        gate: "12 of 22 get a yes",
      },
      {
        n: "1",
        name: "The shell",
        weeks: "2",
        status: "partial",
        state: "sign-up and rules API built; player app not started",
        gate: "walk from PLAY to the ladder",
      },
      {
        n: "2",
        name: "Identity",
        weeks: "1",
        status: "built",
        state: "seasons, roles, hearts, 16+; one account, shop and game",
        gate: "hearts come from the database",
      },
      {
        n: "3",
        name: "The loop",
        weeks: "3",
        status: "built",
        state: "draw, server clock, upload, coins, both ledgers, clans",
        gate: "five people play a season",
      },
      {
        n: "4",
        name: "Control room",
        weeks: "2",
        status: "built",
        state: "admin.stiff.co, thirteen screens",
        gate: "a season run without psql",
      },
      {
        n: "5",
        name: "Shippable season",
        weeks: "1.5",
        status: "partial",
        state: "board, clawback, wars, coin shop built; bundles, pass, prizes not",
        gate: "someone plays it, and enjoys it",
      },
      {
        n: "6",
        name: "The AI",
        weeks: "5",
        status: "partial",
        state: "four agents built and enforcing; clips and liveness not",
        gate: "shadow mode agrees with staff",
      },
      {
        n: "7",
        name: "Season one",
        weeks: "—",
        status: "planned",
        state: "300–500 invited players, filmed",
        gate: "six numbers measured",
      },
    ],
    foot: "Weeks are the roadmap's estimates. The gates matter more than the weeks.",
    notes: [
      "Each level produces something that works on its own and has a gate — a condition that must be true before the next starts. Skipping a gate is how you end up with an expensive media pipeline verifying tasks nobody enjoys.",
      "Built and tested on main: seasons and their lifecycle, sign-up with the 16+ gate, enrolment as player or watcher, hearts and the server clock, the draw, the two-step signed upload, coins with the coin and score ledgers, clans and team tasks, the watchers' vote and its resolver, the feed with likes, comments and shares, the board and search, clan wars with the coin book, the coin shop, reports with auto-hide, the cheat detector, the two-agent task pipeline, and the thirteen-screen control room. 982 tests cover the game.",
      "Levels 2 to 4 are marked built for the code; their gates are about people playing, and they cannot be passed until there is an app to play in. Level 6's gate was deliberately overridden by the owner — the models act without a shadow season.",
      "Not yet built: the player's web app, tasks in the pool, coin bundles, the season pass, prizes, live bank credentials, AI judgement of clips and a liveness challenge. Level 5 is the first complete game — a season for 300 people could run from there.",
    ],
  },

  {
    id: "not-built",
    kind: "list",
    section: "The plan",
    theme: "light",
    title: "What is not built, in the order a season needs it.",
    items: [
      "The player app at stiff.co — every rule is an endpoint with no screen",
      "Tasks in the pool — it is empty; the 22 dares are a document",
      "Coin bundles on TBC and BOG cards — decided, not written",
      "The season pass and prizes",
      "Live bank credentials — card payments run in test mode",
      "AI judgement of clips, and a liveness challenge — clips go to a person",
    ],
    tail: "Everything else in this journal is in the code on main, with tests.",
    notes: [
      "The order is the order a season needs them in. Without the player app there is no season at all; without tasks in the pool there is nothing to draw; coin bundles and the season pass are the first revenue; live bank credentials turn test-mode card payments into real ones; AI judgement of clips and a liveness challenge reduce how much lands on a person.",
      "None of these is a redesign. The app talks to an API that already exists; tasks go through a pipeline and approval screen that already exist; bundles go through the payments service the shop already uses.",
    ],
  },

  {
    id: "gaps",
    kind: "list",
    section: "The plan",
    theme: "light",
    journalOnly: true,
    title: "Where the code and the documents disagree. The code is the rule.",
    items: [
      "Clip length: the Charter says 60 s, 3 min, 5 min by day; the server takes 5 s–2 min every day",
      "Cut lines: the roadmap and hosting note still size 5,000 → 1,000 → 100; they were removed",
      "Age and phone: the roadmap says 18+ with a verified phone; the game is 16+ with neither",
      "Shadow mode: the roadmap's gate before a model moves a score was overridden",
      "Escrow, and hearts burned on a short balance: designed, not built",
      "The 22 dares predate the 24-item blocklist, 16+ and the reward fields",
      "A vote pays yes only, so the rule rewards saying yes — kept, and flagged",
      "The season table's own comment says running closes enrolment; it no longer does",
    ],
    notes: [
      "Clip length is the one with a player-facing consequence: a day-three task written for a five-minute clip cannot be handed in. Either the Charter's tiers come down to two minutes or the server's cap goes up by tier — and a longer cap moves the 40 MB limit and the media arithmetic with it.",
      "The document drift is harmless while nobody builds from those documents, and dangerous the moment someone does: ROADMAP.md on the game branch still describes the cut lines, 18+ and phone verification, a fourth token audience for the panel, and a game app at game.stiff.ge rather than stiff.co. The game's name is Stiff and its home is stiff.co, by the owner's decision on 10 September.",
      "The vote rule and the open-votes list showing unreviewed hand-ins are product choices the owner made with the consequences stated. They are listed so a reader of this journal knows they were deliberate.",
      "A small one for whoever runs things locally: this journal and the game's panel both use port 3004 in development, so they cannot run at the same time without moving one.",
    ],
  },

  {
    id: "season-one",
    kind: "list",
    section: "Season one",
    theme: "light",
    title: "Season one: 300–500 invited players, filmed, measured on six numbers.",
    items: [
      "Cost per verified attempt",
      "Review queue depth",
      "Decline rate against pool supply",
      "Votes cast per published clip",
      "Players reaching day three with hearts",
      "New shop customers acquired",
    ],
    emphasiseLast: true,
    tail: "Five of these tell you whether the game works. The sixth tells you whether it was worth building.",
    notes: [
      "Season one is small, cheap and filmed: mostly existing customers and their friends, live bank credentials, a stocked coin shop, almost no sponsorship — sponsors buy proven audience and there is not one yet.",
      "Every one of the six can be read straight from the data the server already keeps: the model calls and the review queue, declined and expired tasks against the pool, the vote table, hearts per player at the start of day three, and shop orders from accounts that enrolled in the game.",
      "Budget for a camera operator at the final even though nothing is sponsored. The tape is what sells season two.",
    ],
  },

  {
    id: "ask",
    kind: "ask",
    section: "The ask",
    theme: "light",
    title: "The raise buys the player app, season one, and the six numbers that decide season two.",
    notes: [
      "Use of funds follows what is left to build: the player app and the first revenue paths, then the season itself — prizes, stock for the coin shop, a camera operator — plus running cost and the legal work, which has a long lead time and gates season one rather than the build.",
      "The milestone is deliberately not revenue. It is a played season with the six numbers measured, because those numbers are what decide whether season two is worth funding at a different scale.",
    ],
  },

  {
    id: "close",
    kind: "statement",
    section: "STIFF",
    theme: "light",
    title: "The only number that really matters: new shop customers acquired.",
    foot: "stiff.ge",
    notes: [
      "This slide stays on screen through questions. Everything else in the deck exists to move this number.",
    ],
  },
];

/** The presented cut: every slide that is not a rulebook page. */
export const DECK_SLIDES: Slide[] = SLIDES.filter((s) => !s.journalOnly);

/** 1-based folio for the counter; the cover has none. */
export function folio(index: number): string {
  return String(index + 1).padStart(2, "0");
}
