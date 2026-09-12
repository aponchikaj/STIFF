"use client";

import { useState, type FormEvent } from "react";
import { gameApi } from "@/lib/api";
import type { GameSeason, SeasonStatus } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  btnGhostSm,
  btnSolidSm,
  ErrorNote,
  Field,
  inputCls,
  Loading,
} from "../ui";
import {
  ConfirmButton,
  Empty,
  Facts,
  Note,
  Pill,
  SectionTitle,
  formatDateTime,
  timeAgo,
  useAction,
} from "./game-ui";

const SEASON_TONE: Record<SeasonStatus, "neutral" | "solid" | "outline"> = {
  draft: "neutral",
  open: "outline",
  running: "solid",
  closed: "neutral",
};

// Mirrors CreateSeasonDto so a bad slug is caught before the round trip.
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i;
const DEFAULT_HEARTS = 3;

/**
 * Seasons: make one, then walk it draft → open → running → closed. Each row
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
    <div className="space-y-12">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section>
          <SectionTitle
            aside={
              live ? (
                <span className="text-xs text-muted">
                  live now: <span className="text-foreground">{live.title}</span>
                </span>
              ) : (
                <span className="text-xs text-muted">between seasons</span>
              )
            }
          >
            Seasons
          </SectionTitle>
          <p className="mb-4 max-w-2xl text-xs leading-6 text-muted">
            Only one season can be open or running at a time. The server
            refuses a second and names the one in the way. Starting the clock
            stamps the start time; closing stamps the end. Neither is undone
            by moving back.
          </p>
          <Note>{note}</Note>

          {rows.length === 0 ? (
            <Empty>
              No seasons yet. Make one on the right; it lands as a draft
              until you open it.
            </Empty>
          ) : (
            <ul className="mt-4 border-t border-subtle">
              {rows.map((season) => (
                <SeasonRow
                  key={season.id}
                  season={season}
                  busy={busy}
                  onStatus={(status, done) =>
                    act(
                      () => gameApi.setSeasonStatus(season.id, status),
                      done,
                    )
                  }
                />
              ))}
            </ul>
          )}
        </section>

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
    </div>
  );
}

// ------------------------------------------------------------------ row --

function SeasonRow({
  season,
  busy,
  onStatus,
}: {
  season: GameSeason;
  busy: boolean;
  onStatus: (status: SeasonStatus, done: string) => void | Promise<void>;
}) {
  return (
    <li className="border-b border-subtle py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-bold uppercase tracking-wide">
            {season.title}
          </span>
          <span className="text-xs text-muted">{season.slug}</span>
        </p>
        <span className="flex flex-wrap items-center gap-2">
          <Pill tone={SEASON_TONE[season.status]}>{season.status}</Pill>
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
            created {timeAgo(season.createdAt)}
          </span>
        </span>
      </div>

      <div className="mt-3">
        <Facts
          rows={[
            { label: "Hearts to start", value: season.startingHearts },
            { label: "Starts", value: formatDateTime(season.startsAt) },
            { label: "Ends", value: formatDateTime(season.endsAt) },
            { label: "Created", value: formatDateTime(season.createdAt) },
          ]}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        {season.status === "draft" && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onStatus("open", `“${season.title}” is open. Players can enrol.`)
            }
            className={btnGhostSm}
          >
            Open enrolment
          </button>
        )}
        {season.status === "open" && (
          <>
            <ConfirmButton
              label="Start the clock"
              confirmLabel="Start it? This stamps the start time."
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
              className={btnGhostSm}
            >
              Back to draft
            </button>
          </>
        )}
        {season.status === "running" && (
          <ConfirmButton
            label="Close the season"
            confirmLabel="Close it? This ends play for everyone."
            disabled={busy}
            onConfirm={() =>
              onStatus("closed", `“${season.title}” is closed.`)
            }
          />
        )}
        {season.status === "closed" && (
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted">
            Finished
          </span>
        )}
      </div>
    </li>
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
    <section>
      <SectionTitle>New season</SectionTitle>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
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
          <p id="season-slug-hint" className="text-xs text-muted">
            Letters, numbers and hyphens. It&apos;s in the URL, so pick it once.
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
            className={`${inputCls} max-w-32`}
          />
        </Field>

        <p aria-live="polite" className="min-h-4 text-xs text-muted">
          {problem}
        </p>

        <button type="submit" disabled={busy} className={btnSolidSm}>
          Create as draft
        </button>
        <p className="text-xs leading-6 text-muted">
          A new season always lands as a draft. Nobody can enrol until you
          open it from the list.
        </p>
      </form>
    </section>
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
