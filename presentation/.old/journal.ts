import type { Page } from "./blocks";

/**
 * OPAL — Journal. Eighteen surfaces: a cover, sixteen pages, a back board.
 *
 * Everything here comes from the game's own documents on the `game` branch —
 * `docs/game/ROADMAP.md`, `docs/game/hosting.md` and
 * `docs/game/tasks/season-zero-tasks.md`. Numbers are quoted, not invented.
 * Where this journal and those documents disagree, the documents are right.
 * The one figure that is not quoted is the revenue split, and the page it
 * appears on says so.
 */
export const PAGES: Page[] = [
  { id: "cover", kind: "cover" },

  {
    id: "opening",
    kind: "title",
    title: "Opal",
    subtitle: "A working journal",
    blocks: [
      {
        kind: "p",
        text: "This is a working document, not a pitch. It sets out what the game is, in what order it gets built, what it costs to run and where the money comes from. It is written for the people making it and for anyone deciding whether to back it.",
      },
      {
        kind: "p",
        text: "Every figure here is quoted from the project's own roadmap, hosting notes and task list. One chart is a projection rather than a measurement, and it is marked as such on the page. Nothing else is estimated.",
      },
      { kind: "rule" },
      {
        kind: "stats",
        items: [
          { value: "3", label: "days in a season" },
          { value: "8", label: "levels to build" },
          { value: "22", label: "tasks written" },
        ],
      },
    ],
  },

  {
    id: "what",
    kind: "page",
    section: "The game",
    title: "What Opal is",
    blocks: [
      {
        kind: "lead",
        text: "Opal is a three-day game. A player is given a dare, has a fixed time to do it, films it on their own phone and uploads the result. If it passes, they move up. If it fails, they lose a heart.",
      },
      {
        kind: "p",
        text: "There are two roles and you cannot hold both in one season. Players take the dares. Watchers watch, vote, and decide who survives to the next day. The watcher is not an audience bolted onto a game — the vote is the mechanism the game runs on.",
      },
      {
        kind: "p",
        text: "There is no live streaming, and that is a decision rather than a gap. Every attempt is a recording, captured on the phone and uploaded when the clock stops. Dropping live removes the streaming provider, the publishing pipeline, the socket rooms, the concurrent-stream capacity and the kill switch from the plan entirely.",
      },
      {
        kind: "quote",
        text: "What it costs is the feeling of watching together in the moment. What it buys is a game one person can operate, that survives a Georgian mobile network, and whose media bill is measured in single digits.",
      },
    ],
  },

  {
    id: "plate-1",
    kind: "plate",
    plate: "0036",
    chapter: "I · The game",
    caption: "From the archive. Tbilisi.",
  },

  {
    id: "three-days",
    kind: "page",
    section: "The game",
    title: "Three days",
    blocks: [
      {
        kind: "p",
        text: "A season runs three days and each day cuts the field. The cut lines are published before the season starts, so nobody discovers the rules at the moment they are eliminated by them.",
      },
      {
        kind: "ladder",
        days: [
          { day: "I", name: "Qualifier", count: "5,000", cap: "photo or ≤60s" },
          { day: "II", name: "Nerve", count: "1,000", cap: "≤3 min" },
          { day: "III", name: "Final", count: "100", cap: "≤5 min" },
        ],
      },
      {
        kind: "p",
        text: "Day one is built so five thousand people can attempt it — indoors if they want, no risk, provable from a still photograph. By day three a hundred are left and the tasks assume a camera and an audience.",
      },
      {
        kind: "note",
        text: "Ties break on completion timestamp: whoever finished first is ahead. The rule is published in advance, like the cut lines.",
      },
    ],
  },

  {
    id: "hearts",
    kind: "page",
    section: "The game",
    title: "Hearts and Nerve",
    blocks: [
      {
        kind: "lead",
        text: "Three hearts, and they do not come back inside a season.",
      },
      {
        kind: "p",
        text: "A heart burns when a penalty is larger than the coins a player has earned. The order matters: coins are spent first, and a heart only goes when there is nothing left to spend. Lose all three and the season is over for you.",
      },
      {
        kind: "p",
        text: "Nerve is a score, not a life. It measures how far a player went and how much the watchers rated it. The Nerve board decides who crosses each cut line — the coin balance never does. Keeping the two apart is what stops the game becoming pay-to-win, because coins can be bought and Nerve cannot.",
      },
      {
        kind: "stats",
        items: [
          { value: "3", label: "hearts", note: "per season" },
          { value: "0", label: "regained", note: "within a season" },
          { value: "1", label: "role", note: "player or watcher" },
        ],
      },
    ],
  },

  {
    id: "loop",
    kind: "page",
    section: "The game",
    title: "The loop",
    blocks: [
      {
        kind: "p",
        text: "One task, end to end. The server owns the clock; the phone only displays it.",
      },
      {
        kind: "steps",
        items: [
          {
            n: "01",
            title: "Assign",
            text: "A task is drawn from the pool. The same task never reaches the same player twice.",
          },
          {
            n: "02",
            title: "Accept",
            text: "Take it or decline. Declining returns it to the pool and costs the player a penalty.",
          },
          {
            n: "03",
            title: "Clock",
            text: "Time starts on the server. Coins are locked in escrow — neither the player's nor the game's until a verdict lands.",
          },
          {
            n: "04",
            title: "Prove",
            text: "The phone records. When the clock stops the file uploads straight to storage.",
          },
          {
            n: "05",
            title: "Verdict",
            text: "Pass or fail. Escrow is released, burned or refunded on that decision.",
          },
          {
            n: "06",
            title: "Ledger",
            text: "Every movement is written down. Entries are never edited — a reversal is a new opposing entry.",
          },
        ],
      },
    ],
  },

  {
    id: "tasks",
    kind: "page",
    section: "Tasks",
    title: "What we ask",
    blocks: [
      {
        kind: "p",
        text: "Twenty-two dares are written for season zero, spread across the three days. They are real tasks, not templates — each carries its own clock, its brief and machine-readable criteria.",
      },
      { kind: "chart", id: "task-categories" },
      {
        kind: "figure",
        plate: "0052",
        caption: "Every task is set in Tbilisi, and in the clothes.",
      },
    ],
  },

  {
    id: "exclusions",
    kind: "page",
    section: "Tasks",
    title: "What we never ask",
    blocks: [
      {
        kind: "lead",
        text: "The exclusion list is the most important document the game has. It removes almost everything the genre normally does, and what survives is narrower than it first looks — and better.",
      },
      {
        kind: "list",
        items: [
          "Trespass and private property",
          "Traffic",
          "Heights and water",
          "Fire and substances",
          "Confrontation and physical contact",
          "Nudity",
          "Minors",
          "Deception and public disruption",
          "Animals and stunts",
          "Spending money",
        ],
      },
      {
        kind: "p",
        text: "Every task is checked against the list twice: once in the wording of the brief, and again by a safety classifier. That is the difference between a task that reads fine and a task that is fine.",
      },
    ],
  },

  {
    id: "proof",
    kind: "page",
    section: "Proof",
    title: "How it is proved",
    blocks: [
      {
        kind: "p",
        text: "Two rules decide both the architecture and the bill.",
      },
      {
        kind: "steps",
        items: [
          {
            n: "01",
            title: "Bytes never touch the API",
            text: "The browser asks for a signed URL and puts the file straight into object storage. The server sees a few hundred bytes of JSON and never the video.",
          },
          {
            n: "02",
            title: "The phone records at delivery bitrate",
            text: "720p, about 1.5 Mbps, with a hard cap per tier. The file uploaded is the file served, so there is no transcoding stage at all.",
          },
        ],
      },
      {
        kind: "p",
        text: "Proving a recording is fresh is the job of a challenge word. The server picks a second, shows a word on the player's own screen at that moment, and requires it to appear in the recording at the matching timestamp. Re-uploading last week's clip cannot satisfy that.",
      },
      {
        kind: "p",
        text: "Together the two rules delete a whole stage of the system. There is no transcoding service to run, no second copy of every file to store, and about a third less upload volume than the same season would move if the phone recorded at capture quality and something else shrank it afterwards.",
      },
      {
        kind: "note",
        text: "The same permission a broadcaster would need is still required, because MediaRecorder wants it. The shop disables the camera globally; the game ships its own header on its own origin.",
      },
    ],
  },

  {
    id: "volume",
    kind: "page",
    section: "Proof",
    title: "What a season moves",
    blocks: [
      {
        kind: "p",
        text: "A thousand players, three days, and every attempt recorded. The arithmetic below is written out rather than asserted, because it is the number every hosting decision in this journal is sized against.",
      },
      { kind: "chart", id: "media-volume" },
      {
        kind: "p",
        text: "Delivery is the variable, not upload. Around 1,220 clips get published for voting, and what they cost depends entirely on how many people watch them — which nobody knows yet.",
      },
    ],
  },

  {
    id: "plate-2",
    kind: "plate",
    plate: "0048",
    chapter: "II · The money",
    caption: "From the archive. Tbilisi.",
  },

  {
    id: "economy",
    kind: "page",
    section: "Economy",
    title: "Coins and the ledger",
    blocks: [
      {
        kind: "lead",
        text: "There are two currencies and they never mix. Earned coins are won in play. Bought coins arrive on a card. Every ledger entry records which is which.",
      },
      {
        kind: "p",
        text: "That distinction is in the schema from the first migration rather than added later, and the reason is practical: prizes, refunds and disputes have to treat bought and earned differently, and if the source was never written down it cannot be reconstructed afterwards.",
      },
      {
        kind: "p",
        text: "The ledger is append-only. When a verdict is overturned the original entry stays and an opposing entry is written beside it. Score clawback works the same way — nothing is quietly rewritten, so the history of a season is always readable.",
      },
      {
        kind: "note",
        text: "Escrow: coins lock on accept and settle on verdict — released, burned or refunded. A player can never stake what they do not hold.",
      },
    ],
  },

  {
    id: "money",
    kind: "page",
    section: "Money",
    title: "Where money comes from",
    blocks: [
      {
        kind: "p",
        text: "Four sources. Three come from the player, the fourth from outside. The order is not arbitrary — sponsorship is last because it is the only one that requires an audience you already have.",
      },
      { kind: "chart", id: "revenue-split" },
      {
        kind: "note",
        text: "Budget for a camera operator at the final even when nothing is sponsored. The tape is what sells season two.",
      },
    ],
  },

  {
    id: "bill",
    kind: "page",
    section: "Money",
    title: "What it costs to run",
    blocks: [
      {
        kind: "p",
        text: "Five Next.js apps on one Vercel seat, the API on Render, Postgres on Supabase, media on Cloudflare R2, Redis on Upstash, mail on Resend. Uploads bypass the API entirely, so a season scales the app for clock polling and the review queue — not for video.",
      },
      { kind: "chart", id: "monthly-bill" },
      {
        kind: "stats",
        items: [
          { value: "$50", label: "Render", note: "API, steady" },
          { value: "$30", label: "Supabase", note: "Postgres" },
          { value: "$1", label: "R2", note: "all media" },
        ],
      },
      {
        kind: "note",
        text: "Four things would break this: serving video through the app instead of R2, staying on Cloudinary, choosing AWS for media and then going viral, or leaving database compute scaled up after a season ends.",
      },
    ],
  },

  {
    id: "storage",
    kind: "page",
    section: "Money",
    title: "One line item, the whole bill",
    blocks: [
      {
        kind: "p",
        text: "The same season, priced on two storage providers. Storage, operations and requests are cents on either. The entire difference is egress — what it costs to hand a file back to someone watching.",
      },
      { kind: "chart", id: "r2-vs-aws" },
      {
        kind: "note",
        text: "The half-measure is the worst option: S3 for storage with a CDN in front is billed on the way out of S3 before the CDN ever sees the byte. R2 end to end, or AWS end to end.",
      },
    ],
  },

  {
    id: "build",
    kind: "page",
    section: "Build",
    title: "The order of work",
    blocks: [
      {
        kind: "p",
        text: "Eight levels. Each produces something that works on its own, and each has a gate — a condition that must be true before the next one starts. Skipping a gate is how you end up with an expensive media pipeline verifying tasks nobody enjoys.",
      },
      { kind: "chart", id: "build-timeline" },
      {
        kind: "note",
        text: "Level 0 writes no code at all. It shows twenty-two dares to ten people and asks one question: would you actually do this? If fewer than twelve say yes, the problem is the task design and no amount of engineering fixes it.",
      },
    ],
  },

  { id: "back", kind: "back" },
];

/** Folio numbers skip the boards, the way a printed book does. */
export function folioFor(index: number): string | null {
  const page = PAGES[index];
  if (!page || page.kind === "cover" || page.kind === "back") return null;
  return String(index);
}
