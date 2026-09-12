"use client";

import { useEffect, useState } from "react";
import { gameApi } from "@/lib/api";
import type { BoardRow } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  btnSecondarySm,
  cardCls,
  ErrorNote,
  Field,
  inputCls,
  Loading,
  Panel,
  tableCls,
  TableScroll,
  tdCls,
  thCls,
  theadCls,
  trCls,
} from "../ui";
import { Empty, Hearts, Stat } from "./game-ui";

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
 * panel below is how an operator finds one name among thousands without
 * paging.
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
    <div className="flex flex-col gap-5">
      {/* --------------------------------------------------------- the count */}
      <div
        className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-3 sm:divide-x`}
      >
        <div className="p-5">
          <Stat
            label="On the board"
            value={n(total)}
            hint="players in the live season"
          />
        </div>
        <div className="p-5">
          <Stat
            label="Elimination"
            value="None"
            hint="a rank is a standing, not a cut"
          />
        </div>
        <div className="p-5">
          <Stat
            label="Leader"
            value={leader ? leader.handle : "—"}
            hint={
              leader
                ? `${n(leader.nerve)} Nerve`
                : rows.length > 0
                  ? "see page 1"
                  : "nobody has scored"
            }
          />
        </div>
      </div>

      {/* --------------------------------------------------------- the board */}
      <Panel
        title="The board"
        aside={
          <span className="text-[11px] text-faint">
            Nerve high to low · ties to whoever got there first, then handle
          </span>
        }
        bleed
      >
        {rows.length === 0 ? (
          <Empty>Nobody is on the board yet.</Empty>
        ) : (
          <TableScroll>
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th scope="col" className={`${thCls} w-14`}>
                    #
                  </th>
                  <th scope="col" className={thCls}>
                    Handle
                  </th>
                  <th scope="col" className={`${thCls} text-right`}>
                    Nerve
                  </th>
                  <th scope="col" className={`${thCls} text-right`}>
                    Coins
                  </th>
                  <th scope="col" className={thCls}>
                    Hearts
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <BoardRow key={`${row.rank}-${row.handle}`} row={row} />
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}

        {pageCount > 1 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
            <button
              type="button"
              disabled={page <= 1 || board.loading}
              onClick={() => setPage((p) => p - 1)}
              className={btnSecondarySm}
            >
              ← Prev
            </button>
            <span className="tnum text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
              page {page} of {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount || board.loading}
              onClick={() => setPage((p) => p + 1)}
              className={btnSecondarySm}
            >
              Next →
            </button>
          </div>
        )}
      </Panel>

      {/* -------------------------------------------------------- the search */}
      <Panel title="Find a player" bleed>
        <div className="px-5 pb-4">
          <div className="max-w-sm">
            <Field id="board-search" label="Handle">
              <input
                id="board-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Part of a handle"
                aria-label="Find a player by handle"
                autoComplete="off"
                className={inputCls}
              />
            </Field>
          </div>
          <p className="mt-2.5 max-w-xl text-[11px] leading-5 text-faint">
            Players only. Watchers are never returned, by design — being in the
            audience does not make someone searchable.
          </p>
        </div>

        {query.length > 0 && query.length < MIN_SEARCH && (
          <Empty>Type at least {MIN_SEARCH} characters.</Empty>
        )}
        {query.length >= MIN_SEARCH && (
          <>
            {found.loading && (
              <div className="px-5">
                <Loading label="Searching" />
              </div>
            )}
            {found.error && (
              <div className="px-5 pb-2">
                <ErrorNote message={found.error} />
              </div>
            )}
            {found.data && !found.loading && found.data.players.length === 0 && (
              <Empty>No player matches &ldquo;{query}&rdquo;.</Empty>
            )}
            {found.data && found.data.players.length > 0 && (
              <ul aria-label="Matching players">
                {found.data.players.map((row) => (
                  <li
                    key={row.handle}
                    className="flex items-center gap-4 border-t border-line px-5 py-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                      {row.handle}
                    </span>
                    <Hearts
                      remaining={row.heartsRemaining}
                      total={row.heartsTotal}
                    />
                    <span className="tnum w-28 text-right text-[13px] font-bold">
                      {n(row.nerve)}
                      <span className="ml-1 text-[11px] font-semibold text-faint">
                        Nerve
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

/** One board row. */
function BoardRow({ row }: { row: BoardRow }) {
  return (
    <tr className={trCls}>
      <td className={`${tdCls} tnum text-[12px] font-bold text-faint`}>
        {row.rank}
      </td>
      <td className={`${tdCls} font-bold`}>{row.handle}</td>
      <td className={`${tdCls} tnum text-right text-[15px] font-bold`}>
        {n(row.nerve)}
      </td>
      <td className={`${tdCls} tnum text-right text-muted`}>{n(row.coins)}</td>
      <td className={tdCls}>
        <Hearts remaining={row.heartsRemaining} total={row.heartsTotal} />
      </td>
    </tr>
  );
}
