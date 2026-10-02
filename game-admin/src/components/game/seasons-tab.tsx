"use client";

import { useState, type FormEvent } from "react";
import { gameApi } from "@/lib/api";
import type { GameSeason, SeasonStatus } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  btnDanger,
  btnPrimary,
  btnPrimarySm,
  btnSecondarySm,
  Card,
  ErrorNote,
  eyebrow,
  Field,
  inputCls,
  Loading,
  Panel,
  sectionTitle,
  type Tone,
} from "../ui";
import {
  ConfirmButton,
  Empty,
  Facts,
  Note,
  Pill,
  formatDateTime,
  timeAgo,
  useAction,
} from "./game-ui";

const SEASON_TONE: Record<SeasonStatus, Tone> = {
  draft: "neutral",
  open: "info",
  running: "solid",
  closed: "neutral",
};

// Mirrors CreateSeasonDto so a bad slug is caught before the round trip.
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i;
const DEFAULT_HEARTS = 3;

/**
 * Seasons: make one, then walk it draft → open → running → closed. Each card
 * shows only the next sensible step, because the server will take any status
 * you send and the ones that go backwards are the ones you regret.
 */
export function SeasonsTab() {
  const seasons = useAsync(() => gameApi.listSeasons(), []);
  const { note, busy, act } = useAction(seasons.reload);

  if (seasons.loading) return <Loading label="Loading seasons" />;
  if (seasons.error) return <ErrorNote message={seasons.error} />;

  const rows = seasons.data?.seasons ?? [];
  const live = rows.find((s) => s.status === "open" || s.status === "running");

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------ where things are */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-2xl">
            <p className={eyebrow}>The pipeline</p>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              Only one season can be open or running at a time. The server
              refuses a second and names the one in the way. Starting the clock
              stamps the start time; closing stamps the end. Neither is undone
              by moving back.
            </p>
          </div>
          <div className="min-w-0">
            <p className={eyebrow}>Live now</p>
            {live ? (
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <span className="font-display text-[18px] leading-none">
                  {live.title}
                </span>
                <Pill tone={SEASON_TONE[live.status]}>{live.status}</Pill>
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-faint">Between seasons</p>
            )}
          </div>
        </div>
        {/* The divider only earns its place when there is something under
            it; an empty strip below a rule reads as a broken card. */}
        {note && (
          <div className="mt-5 border-t border-line pt-3">
            <Note>{note}</Note>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------- the seasons */}
      {rows.length === 0 ? (
        <Card>
          <Empty>
            No seasons yet. Make one below; it lands as a draft until you open
            it.
          </Empty>
        </Card>
      ) : (
        rows.map((season) => (
          <SeasonCard
            key={season.id}
            season={season}
            busy={busy}
            onStatus={(status, done) =>
              act(() => gameApi.setSeasonStatus(season.id, status), done)
            }
            onSchedule={(startsAt, done) =>
              act(() => gameApi.scheduleSeason(season.id, startsAt), done)
            }
          />
        ))
      )}

      {/* ---------------------------------------------------------- the form */}
      <CreateSeasonForm
        busy={busy}
        onCreate={async (input) => {
          // `act` swallows failures into the note; `done` only runs on
          // success, so it is the signal the form uses to clear itself.
          let created = false;
          await act(
            () => gameApi.createSeason(input),
            (r) => {
              created = true;
              const s = r as GameSeason;
              return `“${s.title}” created as a draft. Open enrolment when the tasks are ready.`;
            },
          );
          return created;
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------- card --

function SeasonCard({
  season,
  busy,
  onStatus,
  onSchedule,
}: {
  season: GameSeason;
  busy: boolean;
  onStatus: (status: SeasonStatus, done: string) => void | Promise<void>;
  onSchedule: (startsAt: string | null, done: string) => void | Promise<void>;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className={sectionTitle}>{season.title}</h2>
            <Pill tone={SEASON_TONE[season.status]}>{season.status}</Pill>
          </div>
          <p className="mt-1 font-mono text-[11px] text-faint">{season.slug}</p>
        </div>
        <p className="text-[11px] text-faint">
          created {timeAgo(season.createdAt)}
        </p>
      </div>

      <div className="mt-4">
        <Facts
          rows={[
            {
              label: "Hearts to start",
              value: <span className="tnum">{season.startingHearts}</span>,
            },
            {
              label: "Starts",
              value: <span className="tnum">{formatDateTime(season.startsAt)}</span>,
            },
            {
              label: "Ends",
              value: <span className="tnum">{formatDateTime(season.endsAt)}</span>,
            },
            {
              label: "Created",
              value: (
                <span className="tnum">{formatDateTime(season.createdAt)}</span>
              ),
            },
          ]}
        />
      </div>

      {(season.status === "draft" || season.status === "open") && (
        <ScheduleControl season={season} busy={busy} onSchedule={onSchedule} />
      )}
      {season.startsAt && <OpalTimeline startsAt={season.startsAt} />}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {season.status === "draft" && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onStatus("open", `“${season.title}” is open. Players can enrol.`)
            }
            className={btnPrimarySm}
          >
            Open enrolment
          </button>
        )}
        {season.status === "open" && (
          <>
            <ConfirmButton
              label="Start the clock"
              confirmLabel="Press again to start"
              className={btnSecondarySm}
              disabled={busy}
              onConfirm={() =>
                onStatus(
                  "running",
                  `“${season.title}” is running. The clock started now.`,
                )
              }
            />
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onStatus(
                  "draft",
                  `“${season.title}” is back in draft. Nobody can enrol.`,
                )
              }
              className={btnSecondarySm}
            >
              Back to draft
            </button>
            <p className="text-[11px] text-faint">
              {season.startsAt
                ? "Starts itself at the scheduled time. Starting now moves the start to now."
                : "Starting stamps the start time."}
            </p>
          </>
        )}
        {season.status === "running" && (
          <>
            <ConfirmButton
              label="Close the season"
              confirmLabel="Press again to close"
              className={btnDanger}
              disabled={busy}
              onConfirm={() => onStatus("closed", `“${season.title}” is closed.`)}
            />
            <p className="text-[11px] text-faint">
              Closing ends play for everyone.
            </p>
          </>
        )}
        {season.status === "closed" && (
          <p className="text-[11px] text-faint">Finished. Nothing left to do.</p>
        )}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------- schedule --

const HOUR = 3_600_000;
const OPAL_HOURS = 24;

/** A Date as the value a `datetime-local` input wants, in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * When opal 001 unlocks. A `datetime-local` is read in this browser's own
 * time zone — named under the field, because "00:00" means a different
 * moment in Tbilisi and in London — and sent as an absolute ISO instant.
 */
function ScheduleControl({
  season,
  busy,
  onSchedule,
}: {
  season: GameSeason;
  busy: boolean;
  onSchedule: (startsAt: string | null, done: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(toLocalInput(season.startsAt));
  const [problem, setProblem] = useState<string | null>(null);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fieldId = `schedule-${season.id}`;

  function save(e: FormEvent) {
    e.preventDefault();
    const when = new Date(value);
    if (!value || Number.isNaN(when.getTime())) {
      setProblem("Pick a date and a time.");
      return;
    }
    if (when.getTime() <= Date.now() + 60_000) {
      setProblem("Pick a start at least a minute from now.");
      return;
    }
    setProblem(null);
    void onSchedule(
      when.toISOString(),
      `“${season.title}” starts ${formatDateTime(when.toISOString())}. Opal 001 unlocks then.`,
    );
  }

  return (
    <form
      onSubmit={save}
      noValidate
      className="mt-4 flex flex-col gap-3 rounded-[var(--radius-control)] border border-line bg-raised p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <span className="block w-64">
          <Field id={fieldId} label="Start (opal 001 unlocks)">
            <input
              id={fieldId}
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-describedby={`${fieldId}-hint`}
              className={inputCls}
            />
          </Field>
        </span>
        <button type="submit" disabled={busy} className={btnPrimarySm}>
          {season.startsAt ? "Reschedule" : "Schedule start"}
        </button>
        {season.startsAt && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setValue("");
              void onSchedule(null, `“${season.title}” has no start time now.`);
            }}
            className={btnSecondarySm}
          >
            Clear
          </button>
        )}
      </div>
      <p id={`${fieldId}-hint`} className="text-[11px] leading-5 text-faint">
        Your time zone: {zone}. Each opal lasts {OPAL_HOURS} hours, so the season
        ends 72 hours after the start. An open season starts itself on time; a
        draft has to be opened first.
      </p>
      {problem && <ErrorNote message={problem} />}
    </form>
  );
}

/** The three opals' windows, so the operator sees what players will see. */
function OpalTimeline({ startsAt }: { startsAt: string }) {
  const start = new Date(startsAt).getTime();
  // Read once on mount: a timeline glanced at, not a clock to watch.
  const [now] = useState(() => Date.now());
  return (
    <ol className="mt-4 grid gap-2 sm:grid-cols-3">
      {[1, 2, 3].map((day) => {
        const opens = start + (day - 1) * OPAL_HOURS * HOUR;
        const closes = opens + OPAL_HOURS * HOUR;
        const state = now < opens ? "locked" : now < closes ? "open" : "closed";
        return (
          <li
            key={day}
            className="rounded-[var(--radius-control)] border border-line bg-raised px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[13px] font-bold">
                Opal {String(day).padStart(3, "0")}
              </span>
              <Pill tone={state === "open" ? "positive" : state === "locked" ? "caution" : "neutral"}>
                {state}
              </Pill>
            </div>
            <p className="tnum mt-1 text-[11px] leading-5 text-faint">
              {formatDateTime(new Date(opens).toISOString())} →{" "}
              {formatDateTime(new Date(closes).toISOString())}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

// ----------------------------------------------------------------- form --

function CreateSeasonForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  /** Resolves true when the season was made, so the form knows to reset. */
  onCreate: (input: {
    slug: string;
    title: string;
    startingHearts?: number;
  }) => Promise<boolean>;
}) {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [hearts, setHearts] = useState(String(DEFAULT_HEARTS));
  const [problem, setProblem] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();
    const cleanTitle = title.trim();
    const heartCount = Number(hearts);

    const fault = validate(cleanSlug, cleanTitle, heartCount);
    setProblem(fault);
    if (fault) return;

    void onCreate({
      slug: cleanSlug,
      title: cleanTitle,
      startingHearts: heartCount === DEFAULT_HEARTS ? undefined : heartCount,
    }).then((created) => {
      if (!created) return;
      setSlug("");
      setTitle("");
      setHearts(String(DEFAULT_HEARTS));
    });
  }

  return (
    <Panel eyebrow="Create" title="New season">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="season-title" label="Title">
            <input
              id="season-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Season one"
              maxLength={120}
              required
              className={inputCls}
            />
          </Field>
          <Field id="season-slug" label="Slug">
            <input
              id="season-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="season-1"
              maxLength={60}
              required
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby="season-slug-hint"
              className={inputCls}
            />
            <p
              id="season-slug-hint"
              className="text-[11px] leading-5 text-faint"
            >
              Letters, numbers and hyphens. It&apos;s in the URL, so pick it
              once.
            </p>
          </Field>
          <Field id="season-hearts" label="Hearts to start">
            <input
              id="season-hearts"
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              step={1}
              value={hearts}
              onChange={(e) => setHearts(e.target.value)}
              className={`${inputCls} tnum`}
            />
          </Field>
        </div>

        <p
          aria-live="polite"
          className="min-h-5 text-[12px] leading-5 text-danger"
        >
          {problem}
        </p>

        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <button type="submit" disabled={busy} className={btnPrimary}>
            Create as draft
          </button>
          <p className="max-w-md text-[11px] leading-5 text-faint">
            A new season always lands as a draft. Nobody can enrol until you
            open it from the list above.
          </p>
        </div>
      </form>
    </Panel>
  );
}

/** The same limits as the server's DTO, so the first error is instant. */
function validate(
  slug: string,
  title: string,
  hearts: number,
): string | null {
  if (slug.length < 2 || slug.length > 60) {
    return "Slug needs 2 to 60 characters.";
  }
  if (!SLUG_RE.test(slug)) {
    return "Slug can only contain letters, numbers and hyphens, and must start with a letter or number.";
  }
  if (title.length < 2 || title.length > 120) {
    return "Title needs 2 to 120 characters.";
  }
  if (!Number.isInteger(hearts) || hearts < 1 || hearts > 10) {
    return "Hearts to start must be a whole number from 1 to 10.";
  }
  return null;
}
