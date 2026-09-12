"use client";

import { useEffect, useState } from "react";
import { gameApi } from "@/lib/api";
import type { BoardRow } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { btnGhostSm, ErrorNote, Field, inputCls, Loading } from "../ui";
import { Empty, SectionTitle, Stat, hearts } from "./game-ui";

// The server's default page; the max it accepts is 100.
const PAGE_SIZE = 50;
// Mirrors MIN_SEARCH_LENGTH on the backend, which answers [] below it anyway.
const MIN_SEARCH = 2;
const EMPTY_SEARCH: { players: BoardRow[] } = { players: [] };

const n = (value: number) => value.toLocaleString("en-GB");

/**
 * The whole Nerve board, fifty to a page.
 *
 * A ranking and nothing more: no cut lines, no field sizes, no elimination.
 * Where a player sits here has never ended anyone's season, and the screen
 * says so rather than leaving an operator to assume otherwise.
 *
 * Read-only on purpose — a score is corrected from the player's ledger, not
 * from the board, so the board stays the thing everyone agrees on. The search
 * box below is how an operator finds one name among thousands without paging.
 */
export function BoardTab() {
  const [page, setPage] = useState(1);
  const board = useAsync(
    () => gameApi.getLeaderboard({ page, pageSize: PAGE_SIZE }),
    [page],
  );

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const found = useAsync(
    () =>
      query.length >= MIN_SEARCH
        ? gameApi.searchPlayers(query)
        : Promise.resolve(EMPTY_SEARCH),
    [query],
  );

  if (board.loading && !board.data) return <Loading label="Loading the board" />;
  if (board.error) return <ErrorNote message={board.error} />;
  if (!board.data) return null;

  const { rows, total } = board.data;
  const pageSize = board.data.pageSize || PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Rank 1 is only on page 1; elsewhere the first row is not the leader.
  const leader = rows[0]?.rank === 1 ? rows[0] : null;
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <Stat
          label="On the board"
          value={n(total)}
          hint="players in the live season"
        />
        <Stat
          label="Elimination"
          value="None"
          hint="a rank is a standing, not a cut"
        />
        <Stat
          label="Leader"
          value={leader ? leader.handle.toUpperCase() : "—"}
          hint={
            leader
              ? `${n(leader.nerve)} Nerve`
              : rows.length > 0
                ? "see page 1"
                : "nobody has scored"
          }
        />
      </div>

      <section>
        <SectionTitle
          aside={
            <span className="text-xs text-muted">
              Nerve high to low · ties to whoever got there first, then handle
            </span>
          }
        >
          The board
        </SectionTitle>

        {rows.length === 0 ? (
          <Empty>Nobody is on the board yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-t border-subtle text-sm">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
                  <th scope="col" className="w-14 py-3 pr-3 font-medium">#</th>
                  <th scope="col" className="py-3 pr-3 font-medium">Handle</th>
                  <th scope="col" className="py-3 pr-3 text-right font-medium">Nerve</th>
                  <th scope="col" className="py-3 pr-3 text-right font-medium">Coins</th>
                  <th scope="col" className="py-3 font-medium">Hearts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <BoardRow key={`${row.rank}-${row.handle}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={page <= 1 || board.loading}
              onClick={() => setPage((p) => p - 1)}
              className={btnGhostSm}
            >
              ← Prev
            </button>
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              page {page} of {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount || board.loading}
              onClick={() => setPage((p) => p + 1)}
              className={btnGhostSm}
            >
              Next →
            </button>
          </div>
        )}
      </section>

      <section className="max-w-xl">
        <SectionTitle>Find a player</SectionTitle>
        <Field id="board-search" label="Handle">
          <input
            id="board-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Part of a handle"
            aria-label="Find a player by handle"
            autoComplete="off"
            className={`${inputCls} h-10`}
          />
        </Field>
        <p className="mt-2 text-xs leading-6 text-muted">
          Players only. Watchers are never returned, by design — being in the
          audience does not make someone searchable.
        </p>

        {query.length > 0 && query.length < MIN_SEARCH && (
          <Empty>Type at least {MIN_SEARCH} characters.</Empty>
        )}
        {query.length >= MIN_SEARCH && (
          <>
            {found.loading && <Loading label="Searching" />}
            {found.error && <ErrorNote message={found.error} />}
            {found.data && !found.loading && found.data.players.length === 0 && (
              <Empty>No player matches &ldquo;{query}&rdquo;.</Empty>
            )}
            {found.data && found.data.players.length > 0 && (
              <ul aria-label="Matching players" className="mt-4 border-t border-subtle">
                {found.data.players.map((row) => (
                  <li
                    key={row.handle}
                    className="flex items-baseline justify-between gap-4 border-b border-subtle py-3 text-sm"
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="font-bold uppercase tracking-wide">
                        {row.handle}
                      </span>
                      <span
                        className="text-[10px] tracking-widest text-muted"
                        aria-label={`${row.heartsRemaining} of ${row.heartsTotal} hearts`}
                      >
                        {hearts(row.heartsRemaining, row.heartsTotal)}
                      </span>
                    </span>
                    <span className="tabular-nums">{n(row.nerve)} Nerve</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** One board row. */
function BoardRow({ row }: { row: BoardRow }) {
  return (
    <tr className="border-b border-subtle">
      <td className="py-3 pr-3 text-xs tabular-nums text-muted">{row.rank}</td>
      <td className="py-3 pr-3 font-bold uppercase tracking-wide">
        {row.handle}
      </td>
      <td className="py-3 pr-3 text-right text-base tabular-nums tracking-tight">
        {n(row.nerve)}
      </td>
      <td className="py-3 pr-3 text-right text-xs tabular-nums text-muted">
        {n(row.coins)}
      </td>
      <td
        className="py-3 text-[10px] tracking-widest text-muted"
        aria-label={`${row.heartsRemaining} of ${row.heartsTotal} hearts`}
      >
        {hearts(row.heartsRemaining, row.heartsTotal)}
      </td>
    </tr>
  );
}
