"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Icon } from "@/components/icon";
import {
  Body,
  Button,
  Display,
  Empty,
  Hearts,
  Label,
  Loading,
  Rule,
  Screen,
} from "@/components/ui";
import {
  useAuthState,
  useLeaderboard,
  usePlayerSearch,
  useStanding,
} from "@/lib/queries";
import { useDebounced } from "@/lib/hooks";
import { cn, formatNumber } from "@/lib/utils";

/**
 * `/board` — the leaderboard.
 *
 * Two things the backend is explicit about and the design has to honour.
 *
 * **The board ranks and never cuts.** `eliminationByRank` is false: no
 * position ends anyone's season. So last place is rendered the same as any
 * other row — no red, no warning, no "danger zone". Inventing a drop line
 * would be inventing a rule.
 *
 * **Ties break on who got there first,** which is why two rows can show the
 * same Nerve with different ranks and that is correct, not a bug.
 *
 * Your own row is pinned above the list rather than only highlighted in
 * it — at rank 140 the highlight is three screens down.
 */
export default function BoardPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 300);

  const { isSignedIn } = useAuthState();
  const board = useLeaderboard({ page, pageSize: 25 });
  const standing = useStanding();
  const search = usePlayerSearch(debounced);

  const searching = debounced.trim().length >= 2;

  return (
    <main>
      <Screen width="md" className="flex flex-col gap-8 py-8">
        <header className="flex flex-col gap-3">
          <Label>By Nerve · ties break on who got there first</Label>
          <Display size="title">Leaderboard</Display>
        </header>

        {/* your standing, pinned */}
        {isSignedIn && standing.data ? <YourStanding /> : null}

        {/* search */}
        <div className="flex items-center gap-3 border-b border-blue-dim pb-2.5 transition-colors focus-within:border-cyan">
          <Icon name="search" size="xs" className="opacity-50" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="FIND A PLAYER"
            maxLength={24}
            aria-label="Find a player"
            className="w-full bg-transparent font-pixel text-[11px] uppercase tracking-[0.1em] text-ink outline-none placeholder:text-ink-faint/50"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="opacity-50 transition-opacity hover:opacity-100"
            >
              <Icon name="close" size="xs" />
            </button>
          ) : null}
        </div>

        {/* results */}
        {searching ? (
          search.isLoading ? (
            <Loading label="SEARCHING" />
          ) : (search.data?.length ?? 0) === 0 ? (
            <Empty icon="search" title="Nobody by that name">
              Watchers are not searchable — they chose the audience.
            </Empty>
          ) : (
            <ul className="flex flex-col">
              {search.data?.map((player) => (
                <Row
                  key={player.handle}
                  rank={player.rank ?? 0}
                  handle={player.handle}
                  nerve={player.nerve}
                  cheater={player.status === "cheater"}
                />
              ))}
            </ul>
          )
        ) : board.isLoading ? (
          <Loading label="READING THE BOARD" />
        ) : (board.data?.rows.length ?? 0) === 0 ? (
          <Empty icon="trophy" title="Nobody on the board yet">
            The first hand-in to be judged puts someone here.
          </Empty>
        ) : (
          <>
            <ul className="flex flex-col">
              {board.data?.rows.map((row) => (
                <Row
                  key={row.handle}
                  rank={row.rank}
                  handle={row.handle}
                  nerve={row.nerve}
                  coins={row.coins}
                  hearts={{ remaining: row.heartsRemaining, total: row.heartsTotal }}
                  me={standing.data?.handle === row.handle}
                />
              ))}
            </ul>

            <Pager
              page={board.data?.page ?? 1}
              pageSize={board.data?.pageSize ?? 25}
              total={board.data?.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </Screen>
    </main>
  );
}

/* ------------------------------------------------------------ your row */

function YourStanding() {
  const standing = useStanding();
  const data = standing.data;
  if (!data) return null;

  if (!data.onBoard) {
    return (
      <div className="flex flex-col gap-3 py-2">
        <Label tone="faint">You</Label>
        <Body size="sm">
          {data.status === "cheater"
            ? "You were marked a cheater, so you are off the board for this season."
            : "You are not on the board — a hand-in has to be judged first."}
        </Body>
        <Rule />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <Label>
        You · {data.rank} of {data.total}
      </Label>

      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 max-w-full items-baseline gap-4">
          <span className="shrink-0 font-pixel text-[32px] leading-none text-cyan text-glow-lg tabular-nums">
            #{data.rank}
          </span>
          <span className="min-w-0 truncate font-pixel text-[13px] uppercase tracking-[0.1em] text-ink">
            {data.handle}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <Hearts
            remaining={data.heartsRemaining}
            total={data.heartsTotal}
            size={16}
          />
          <div className="flex items-center gap-2">
            <Icon name="star" size="xs" glow />
            <span className="font-pixel text-[12px] tabular-nums text-cyan">
              {formatNumber(data.nerve)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="opal" size="xs" glow="coin" />
            <span className="font-pixel text-[12px] tabular-nums text-coin">
              {formatNumber(data.coins)}
            </span>
          </div>
        </div>
      </div>

      <Rule tone="blue" />
    </div>
  );
}

/* ---------------------------------------------------------------- rows */

function Row({
  rank,
  handle,
  nerve,
  coins,
  hearts,
  me = false,
  cheater = false,
}: {
  rank: number;
  handle: string;
  nerve: number;
  coins?: number;
  hearts?: { remaining: number; total: number };
  me?: boolean;
  cheater?: boolean;
}) {
  // The top three get a mark. Beyond that a medal is noise, and the board
  // explicitly does not cut anyone, so there is no bottom treatment.
  const crown = rank === 1;
  const podium = rank <= 3 && rank > 0;

  return (
    <motion.li
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex items-center gap-4 py-3.5 transition-colors",
        me && "bg-blue/5",
      )}
    >
      <span
        className={cn(
          "w-10 shrink-0 font-pixel text-[11px] tabular-nums",
          podium ? "text-cyan text-glow-cyan" : "text-ink-faint",
        )}
      >
        {rank > 0 ? rank : "—"}
      </span>

      {crown ? <Icon name="crown" size="xs" glow /> : null}

      <span
        className={cn(
          "min-w-0 flex-1 truncate font-pixel text-[11px] uppercase tracking-[0.08em]",
          cheater ? "text-danger" : me ? "text-cyan text-glow-cyan" : "text-ink",
        )}
      >
        {handle}
        {cheater ? (
          <span className="ml-3 text-[8px] tracking-[0.12em]">Cheater</span>
        ) : null}
      </span>

      {hearts ? (
        <span className="hidden sm:block">
          <Hearts remaining={hearts.remaining} total={hearts.total} size={12} />
        </span>
      ) : null}

      {coins !== undefined ? (
        <span className="hidden w-16 shrink-0 text-right font-pixel text-[10px] tabular-nums text-coin sm:block">
          {formatNumber(coins)}
        </span>
      ) : null}

      <span className="w-16 shrink-0 text-right font-pixel text-[12px] tabular-nums text-cyan text-glow-cyan-xs">
        {formatNumber(nerve)}
      </span>
    </motion.li>
  );
}

function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <Button
        variant="quiet"
        size="sm"
        marker={false}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        ← Back
      </Button>
      <Label tone="faint">
        {page} / {pages}
      </Label>
      <Button
        variant="quiet"
        size="sm"
        marker={false}
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next →
      </Button>
    </div>
  );
}
