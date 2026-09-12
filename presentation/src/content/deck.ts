/**
 * STIFF — investor deck. The shop at stiff.ge, the game at stiff.co.
 *
 * Slides are data so the engine can count, link and lay them out before a
 * single one renders, and so the reading mode can print every slide with its
 * notes from the same source. Nothing is quoted twice.
 *
 * Sources, and the rule about them:
 *   - the game's documents on the `game` branch — docs/game/ROADMAP.md,
 *     docs/game/hosting.md, docs/game/tasks/season-zero-tasks.md
 *   - the code on `main` — backend/src/game/*, backend/src/payments/*
 *   - counts taken from the repository and the latest database dump on
 *     9 September 2026
 * Every figure below is one of those. The one exception is the revenue split,
 * which is a planning assumption and is stamped PROJECTED on its slide.
 *
 * Presented-deck budget: about twenty words on the slide, the rest in `notes`.
 * The notes are the reading deck — they are printed under each slide in
 * reading mode and shown to the presenter in present mode.
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

export type ChartId = "r2-vs-aws" | "revenue-split" | "monthly-bill";

interface Base {
  id: string;
  /** Running head — the chapter this slide belongs to. */
  section: string;
  theme: Theme;
  /** The takeaway. Read the titles alone and the deck should still argue. */
  title: string;
  notes: string[];
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
    { share: "Engineering to Level 5", note: "≈ 11 weeks, by the roadmap" },
    { share: "Season one", note: "mint budget, prizes, a camera at the final" },
    { share: "Running cost", note: "≈ $267 a season month, $131 steady" },
    { share: "Legal", note: "18+, phone verification, prizes" },
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
  {
    id: "cover",
    kind: "cover",
    section: "STIFF",
    theme: "light",
    eyebrow: "Investor deck · Tbilisi · September 2026",
    title: "Essential clothing. And a game the city plays.",
    sub: "STIFF is a Tbilisi clothing brand with a finished shop at stiff.ge and a three-day dare game at stiff.co, built to fill it.",
    plate: "0035",
    notes: [
      "This deck is built from the repository and the game's own documents. Every number on a slide is measured or quoted; the one projection is marked as such where it appears.",
      "It is a presented deck. The slides carry one point each and these notes carry the detail. In reading mode the notes print under every slide, so the same file can be sent ahead.",
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
        text: "A season of video is served for about a dollar on Cloudflare R2.",
      },
      {
        label: "The city",
        text: "Tbilisi is dense enough that a dare set in it becomes a shared event.",
      },
    ],
    notes: [
      "Three things make a filmed city game cheap enough for a clothing brand to run in 2026, and none of them existed in this form a few years ago.",
      "Object storage that does not charge egress changed the arithmetic: the media bill for a thousand-player season is a dollar or two on R2, against tens or hundreds on AWS. That is the whole reason a small operator can afford a video game at all.",
      "Dropping live streaming was the second decision. Every attempt is a recording uploaded when the clock stops, which removes the streaming provider, the socket rooms and the concurrent-stream capacity from the plan, and survives a Georgian mobile network.",
    ],
  },

  {
    id: "arch",
    kind: "arch",
    section: "What exists",
    theme: "light",
    title: "One backend already serves four sites.",
    notes: [
      "One NestJS API on Render serves the shop at stiff.ge, the staff workspace, the admin panel and the game at stiff.co. Postgres is a hosted Supabase instance; media goes to Cloudflare R2; mail is Resend; Redis on Upstash makes a second API instance safe.",
      "The three sessions are not interchangeable. Shop tokens carry no audience, staff tokens carry stiff-staff, admin tokens carry stiff-admin, and the guard refuses one presented as another even though the signing secret is shared. Every state-changing admin request is written to an audit log with credential-shaped keys stripped, and there is no endpoint that edits or deletes an entry.",
      "The game's API — /api/game/* — is built and deployed with the rest. The game's own Next.js app on its own domain, stiff.co, is the piece not yet started.",
    ],
  },

  {
    id: "built",
    kind: "stats",
    section: "What exists",
    theme: "light",
    title: "The platform is built, tested and deployed. The shop is waiting on the game.",
    stats: [
      { value: "574", label: "tests", note: "in 45 suites, run on every push" },
      { value: "168", label: "API routes", note: "counted from the controllers" },
      { value: "29", label: "migrations", note: "on a live, shared Postgres" },
      { value: "56", label: "photographs", note: "in the archive, shot in Tbilisi" },
    ],
    foot: "Counted from the repository and the database on 9 September 2026.",
    notes: [
      "The backend is about 31,000 lines across 289 TypeScript files, with 29 controllers and 37 entities. The game module alone is about 4,100 lines with 247 tests of its own. The shop frontend is about 12,000 lines, the admin panel about 7,500.",
      "stiff.ge deliberately serves a holding page today. The shop publishes after the game ships and a bug pass — the two are meant to launch as one thing, so that the first drop has an audience waiting for it rather than the other way round.",
      "The database holds real content only in the gallery archive. Products, users and orders are effectively empty because nothing has launched. This is a pre-revenue company with a finished platform.",
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
        text: "Guest checkout, Tbilisi and regional shipping, four ways to pay.",
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
      "Guest checkout works by email, and a guest order can later be claimed by the account that earns it. Shipping is pickup, Tbilisi courier, or the regions; fees are placeholders until a courier contract exists.",
      "The collab feature is the largest single feature in the shop — 21 routes. Codes are generated in batches, downloaded as a ZIP of QR codes, revoked and reissued. A scan opens a private film served through a signed, expiring session with byte-range support so a phone can seek. It is the mechanism a sponsored garment task would reuse.",
      "Around all of it: a gallery archive with slugs and alt text, comments and reactions, unified search, admin-editable site copy, notifications, first-party page-view analytics with nightly snapshots, eight transactional email templates, and six scheduled jobs that run once even on several instances.",
    ],
  },

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
      "Chapter two is the game. It shares the brand's name and gets its own domain and its own visual world — the slides go dark here on purpose; the shop is white, the game is not.",
    ],
  },

  {
    id: "what",
    kind: "statement",
    section: "The game",
    theme: "dark",
    title: "Stiff is a three-day dare game. You film it on your own phone, and the city decides.",
    stats: [
      { value: "3", label: "days", note: "one season" },
      { value: "3", label: "hearts", note: "never come back inside a season" },
      { value: "1", label: "role", note: "player or watcher, never both" },
    ],
    notes: [
      "A player is given a dare, has a fixed time to do it, films it on their own phone and uploads the result. If it passes, they move up. If it fails, they lose a heart. Lose all three and the season is over for you.",
      "There are two roles and you cannot hold both in one season. Players take the dares. Watchers watch, vote and decide who survives to the next day. The watcher is not an audience bolted onto a game — the vote is the mechanism the game runs on.",
      "There is no live streaming, and that is a decision rather than a gap. Every attempt is a recording. What it costs is the feeling of watching together in the moment. What it buys is a game one person can operate, that survives a Georgian mobile network, and whose media bill is measured in single digits.",
    ],
  },

  {
    id: "ladder",
    kind: "ladder",
    section: "The game",
    theme: "dark",
    title: "Each day cuts the field. The cut lines are published before anyone starts.",
    days: [
      { day: "I", name: "Qualifier", count: "5,000", cap: "photo or ≤60s", clock: "15 min" },
      { day: "II", name: "Nerve", count: "1,000", cap: "clip ≤3 min", clock: "20 min" },
      { day: "III", name: "Final", count: "100", cap: "clip ≤5 min", clock: "25 min" },
    ],
    foot: "Sized for a 5,000 start. A 1,000-player season cuts 1,000 → 200 → 20.",
    notes: [
      "Day one is built so five thousand people can attempt it: indoors if they want, no risk, provable from a still photograph. By day three a hundred are left and the tasks assume a camera and an audience.",
      "The Nerve board decides who crosses each cut line. Ties break on completion timestamp — whoever finished first is ahead — and that rule is published in advance like the cut lines, so nobody discovers the rules at the moment they are eliminated by them.",
      "The code today enforces a clip of 5 to 120 seconds and 40 MB, with one attempt per player per day held by a database constraint. The per-tier caps in the design (60 seconds, 3 minutes, 5 minutes) are the next refinement of that rule.",
    ],
  },

  {
    id: "loop",
    kind: "steps",
    section: "The game",
    theme: "dark",
    title: "The server owns the clock. The phone only proves what happened.",
    steps: [
      { n: "01", title: "Assign", text: "A dare is drawn from the pool. Never the same one twice." },
      { n: "02", title: "Accept", text: "Take it or decline. Declining costs a penalty." },
      { n: "03", title: "Clock", text: "Time starts on the server. Coins lock in escrow." },
      { n: "04", title: "Prove", text: "Record. When the clock stops, the file goes straight to storage." },
      { n: "05", title: "Verdict", text: "Pass or fail. Escrow releases, burns or refunds." },
      { n: "06", title: "Ledger", text: "Every movement written down. Nothing is ever edited." },
    ],
    notes: [
      "One task, end to end. The clock lives on the server so a phone cannot argue with it. Coins are held in escrow between accept and verdict — neither the player's nor the game's until a decision lands.",
      "The ledger is append-only. When a verdict is overturned the original entry stays and an opposing entry is written beside it, so the history of a season is always readable.",
      "Status: assignment, the server clock and the ledger are designed and specified; the proof upload and the verdict are built and tested. See the roadmap slide.",
    ],
  },

  {
    id: "sides",
    kind: "two",
    section: "The game",
    theme: "dark",
    title: "Players take dares. Watchers vote. Nobody is both.",
    left: {
      label: "Player",
      tone: "hot",
      items: [
        "Starts with three hearts",
        "Films and uploads one attempt a day",
        "Climbs the Nerve board",
        "Findable by handle",
      ],
    },
    right: {
      label: "Watcher",
      tone: "cold",
      items: [
        "No hearts — nothing at stake",
        "Reads the feed without an account",
        "Likes, comments, shares to Stories",
        "Never a search result",
      ],
    },
    notes: [
      "The role is chosen once per season and cannot be changed, and the database makes that a fact rather than a hope: one row per account per season. A player who could switch to watcher after a bad day would be voting on the field they just left.",
      "The feed is readable signed out on purpose, because the feed is what makes someone want an account. Sharing works signed out too — the browser composes a story card and hands it to the phone — so an account is never the price of a share.",
      "Player search finds players only. A watcher chose the audience, and making them findable by name would turn a spectator into a search result. That is a privacy rule, not a filter.",
      "Built today: enrolment, the feed with likes, comments and share counts, the Nerve board and player search. Not yet built: a watcher vote that changes a score.",
    ],
  },

  {
    id: "exclusions",
    kind: "list",
    section: "Safety",
    theme: "dark",
    title: "Fifteen things the game never asks. The list is the product.",
    items: [
      "Trespass",
      "Traffic",
      "Heights",
      "Water",
      "Fire",
      "Substances",
      "Confrontation",
      "Nudity",
      "Touching",
      "Minors",
      "Deception",
      "Disruption",
      "Animals",
      "Stunts",
      "Spending",
    ],
    tail: "What survives: craft · observation · social nerve · performance · style · persuasion.",
    notes: [
      "The exclusion list removes almost everything the genre normally does. What is left is narrower than it first looks, and better — and every one of the twenty-two written tasks is one of the six kinds.",
      "Every task is checked twice: once in the wording of the brief the player reads, and again by a safety screen in code. The screen fails closed: an unrecognised shape is a violation, not a pass. A task it rejects wrongly costs one regeneration; a task it passes wrongly costs somebody an injury or an arrest.",
      "'Spending' is on the list for a commercial reason as well as a safety one. A qualifier that five thousand people attempt must be completable by someone who has never bought anything — that free path is how the game acquires customers rather than only rewarding the ones it already has.",
      "'Minors' is the guard most likely to be broken by accident, so every stranger-facing task carries adults_only and the classifier weights it hardest.",
    ],
  },

  {
    id: "dares",
    kind: "dares",
    section: "Tasks",
    theme: "dark",
    title: "Twenty-two dares are written. Twelve must earn a yes first.",
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
      "Season zero has 22 written dares: 8 qualifiers, 10 for day two, 4 finals. Each carries its tier, its clock, the brief the player reads, machine-readable criteria and guards. They have been run against the exclusion list and have not yet been shown to anyone — that is the first thing the money buys.",
      "Four of them take a garment variant at no design cost: 'wear every black item you own, with your [garment] on the outside'. That is the strongest link between the game and revenue, and it is also what a sponsored task looks like. One garment task per round is the right ratio; the free path must stay free.",
      "A known risk is written down: five tasks depend on Georgian speech transcription. If Georgian ASR is weak they need rewriting — to be tested before season one, not during it.",
    ],
  },

  {
    id: "ai",
    kind: "points",
    section: "Safety",
    theme: "dark",
    title: "Claude drafts tasks. A screen rejects. A person approves.",
    points: [
      {
        label: "The Charter",
        text: "Six parts, hashed at build. Every generated task carries the hash of the rules that wrote it.",
      },
      {
        label: "The screen",
        text: "Fifteen categories, fails closed. Rejections are kept, not discarded.",
      },
      {
        label: "The person",
        text: "Approval is a separate human act. The database refuses an approved task without an approver.",
      },
    ],
    foot: "No coin, heart or Nerve point moves on a model's say-so until shadow mode has agreed with staff for a full season.",
    notes: [
      "The Charter is the safety rulebook the model loads on every call. It is TypeScript rather than Markdown because the build copies only compiled code — a Markdown charter would be present in development and missing in production, the one place its absence matters.",
      "It is sent as one cached system block, so a batch of twenty tasks pays for it once. The reply is forced into a schema, so it is parseable by construction. Then the screen runs, and what it refuses is stored: a rejection rate that climbs is the first sign a Charter edit stopped holding.",
      "The roadmap is explicit: no coin, heart or Nerve point moves on a model's verdict until shadow mode has run for a full season's worth of attempts and agrees with staff often enough to trust. AI task generation is built; AI verification is Level 6.",
    ],
  },

  {
    id: "proof",
    kind: "stats",
    section: "Proof",
    theme: "dark",
    title: "Bytes never touch the API, and the phone records at delivery bitrate.",
    stats: [
      { value: "11 MB", label: "a minute", note: "720p at 1.5 Mbps — the file uploaded is the file served" },
      { value: "13.4 GB", label: "a season", note: "uploaded by 1,000 players over three days" },
      { value: "0", label: "transcoding", note: "no second copy, no pipeline to run" },
    ],
    foot: "The browser puts the file straight into object storage on a signed URL. Freshness is proved by a challenge word shown at a server-chosen second.",
    notes: [
      "Two rules decide both the architecture and the bill. The API hands out a signed URL and the browser uploads directly to storage — the server sees a few hundred bytes of JSON and never the video. Routing a season's uploads through the API would cost bandwidth and memory on an instance sized for JSON.",
      "The phone records at the bitrate the clip will be served at, so there is no transcoding stage at all. At this scale a transcoding service would have cost about $29 a season for a file the phone could simply have produced correctly.",
      "Proving a recording is fresh is the job of a challenge word: the server picks a second, shows a word on the player's own screen at that moment, and requires it to appear in the recording at the matching timestamp. Re-uploading last week's clip cannot satisfy that.",
      "The signed-URL upload path is implemented and tested against a fixed clock and key; it works on R2 or S3. The bucket itself is the one vendor account the game does not have yet.",
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
      "Around 1,220 clips get published for voting in a thousand-player season. What they cost to serve depends entirely on how many people watch them, so the hosting note prices three worlds: light (20 views a clip, 268 GB out), medium (60 views, 805 GB) and viral (300 views, 4 TB).",
      "Storage, operations and requests are cents on either provider. The entire difference is egress — what it costs to hand a file back to someone watching. AWS charges $0.085 a gigabyte; R2 charges nothing.",
      "Do not split them: S3 for storage with a CDN in front is billed on the way out of S3 before the CDN ever sees the byte. R2 end to end, or AWS end to end. Presigned uploads work identically on both, so the choice is reversible if latency measurements on Georgian networks say otherwise.",
    ],
  },

  {
    id: "economy",
    kind: "two",
    section: "Economy",
    theme: "light",
    title: "Coins can be bought. Nerve cannot. That is what stops pay-to-win.",
    left: {
      label: "Coins",
      items: [
        "Earned in play, or bought on a card",
        "Two currencies, never mixed",
        "Escrow on accept, settled on verdict",
        "Append-only ledger; a reversal is a new entry",
      ],
    },
    right: {
      label: "Nerve",
      items: [
        "A score, not a life",
        "Decides every cut line — coins never do",
        "Never bought, never spent",
        "Ties break on who got there first",
      ],
    },
    foot: "Hearts: three a season. One burns only when a penalty exceeds the coins a player has earned. Ash never returns.",
    notes: [
      "The distinction between bought and earned coins is in the schema from the first migration rather than added later, because prizes, refunds and disputes have to treat the two differently and the source cannot be reconstructed afterwards if it was never written down.",
      "There is no balance column anywhere. A wallet is the sum over an append-only ledger with an idempotency key on every row — the shape that cannot lose money to a retried request. This design was built and tested in the project's earlier rhythm game and is the recovery point for Level 3; escrow, the source column and the second currency are the three additions.",
      "Owner decision on record: coins are both earned and purchasable, and purchases reuse the shop's TBC and Bank of Georgia card providers rather than adding a new one.",
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
      "This is the one projected slide in the deck. Season one has not run, so the split is a planning assumption, not a measurement, and it is stamped as such.",
      "Coin bundles are sold by card through the acquirers the shop already has. The season pass is sold before a season opens. Sponsorship is last because it is the only source that requires an audience you already have — sponsors buy proven reach, and there is none until season one has been filmed. The garment-variant task is the natural sponsored shape.",
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
    foot: "One service owns “what makes an order paid”. Coin bundles will go through it — no new provider, no second implementation.",
    notes: [
      "Card is split by acquirer rather than offered as one button because in Georgia the shop holds a merchant account with a specific bank, and which one is live depends on which contract exists. Either, both or neither can be configured; checkout only offers what is usable and shows the rest as coming soon.",
      "Providers never write order status themselves. They report what happened and one PaymentsService owns the transition, so the rule for what makes an order paid lives in one place across four integrations.",
      "The live bank integration deliberately throws until credentials exist, rather than shipping code written blind against a bank API. Everything around it — availability, method selection, the redirect contract, the callback route, the order transition — is real and exercised in test mode. Stripe and PayPal are deliberately absent.",
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
      "A season month with a thousand players and medium viewing is about $267. The step up is a larger Render instance for clock polling and the review queue and a larger Postgres — not for media, because uploads bypass the API entirely.",
      "Running the AI verification cascade adds $50 to $250 depending on how much escalates, which is genuinely unknown until shadow mode runs. Ceiling case about $520; headroom against $750 about $230.",
      "Four things would break the budget, and each is a decision rather than a surprise: serving video through the app instead of R2, staying on Cloudinary, choosing AWS for media and then going viral, or leaving database compute scaled up after a season ends.",
    ],
  },

  {
    id: "roadmap",
    kind: "roadmap",
    section: "The plan",
    theme: "light",
    title: "Levels 0–4 are largely built. Level 5 is the first playable season.",
    levels: [
      {
        n: "0",
        name: "Prove the premise",
        weeks: "1",
        status: "partial",
        state: "22 dares written, not yet shown to anyone",
        gate: "12 of 22 get a yes",
      },
      {
        n: "1",
        name: "The shell",
        weeks: "2",
        status: "partial",
        state: "front-door API built; web app not started",
        gate: "walk from PLAY to the ladder",
      },
      {
        n: "2",
        name: "Identity",
        weeks: "1",
        status: "built",
        state: "seasons, roles, hearts; one account, shop and game",
        gate: "hearts come from the database",
      },
      {
        n: "3",
        name: "The loop",
        weeks: "3",
        status: "partial",
        state: "proof upload built; clock and ledger next",
        gate: "five people play a season",
      },
      {
        n: "4",
        name: "Control room",
        weeks: "2",
        status: "partial",
        state: "review queue and verdicts built; screens next",
        gate: "a season run without psql",
      },
      {
        n: "5",
        name: "Shippable season",
        weeks: "1.5",
        status: "next",
        state: "Nerve board built; prizes, bundles, pass next",
        gate: "someone plays it, and enjoys it",
      },
      {
        n: "6",
        name: "The AI",
        weeks: "5",
        status: "partial",
        state: "charter, screen, generation built; verification next",
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
    foot: "About 15.5 weeks estimated for levels 0–6. The estimates will be wrong; the gates will not.",
    notes: [
      "Each level produces something that works on its own and has a gate — a condition that must be true before the next starts. Skipping a gate is how you end up with an expensive media pipeline verifying tasks nobody enjoys.",
      "Built and tested today, on the deployed backend: seasons and their lifecycle, enrolment as player or watcher, hearts and Nerve per enrolment, the two-step signed upload, the feed with likes, comments and shares, the Nerve board and search, the operator's review queue and verdicts, and the AI task generator with its charter and screen. 247 tests cover the game module.",
      "Not yet built: the game's own web app, phone verification, the server clock per attempt, coins and the ledger, prizes, coin bundles and the season pass, a watcher vote that moves a score, elimination at zero hearts, and AI verification of footage.",
      "Level 5 is the first complete game — a season for 300 people could run from there. Do not start Level 6 until someone has played Level 5 and enjoyed it.",
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
      "Season one is small, cheap and filmed: mostly existing customers and their friends, live bank credentials, a real mint budget, almost no sponsorship — sponsors buy proven audience and there is not one yet.",
      "Budget for a camera operator at the final even though nothing is sponsored. The tape is what sells season two.",
    ],
  },

  {
    id: "ask",
    kind: "ask",
    section: "The ask",
    theme: "light",
    title: "The raise buys Level 5, season one, and the six numbers that decide season two.",
    notes: [
      "Use of funds follows the roadmap: engineering to the first shippable season, then the season itself — mint budget, prizes, a camera operator — plus running cost and the legal work that has a long lead time and gates season one rather than the build.",
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

/** 1-based folio for the counter; the cover has none. */
export function folio(index: number): string {
  return String(index + 1).padStart(2, "0");
}
