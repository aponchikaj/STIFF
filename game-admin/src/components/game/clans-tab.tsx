"use client";

import { useMemo, useState } from "react";
import { gameApi } from "@/lib/api";
import type { ClanMemberRow, ClanRow, EnrolmentStatus, WarStatus } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import {
  Badge,
  btnPrimary,
  cardCls,
  Empty,
  ErrorNote,
  Field,
  inputCls,
  Loading,
  Note,
  Panel,
  selectCls,
  Stat,
  tableCls,
  TableScroll,
  tdCls,
  thCls,
  theadCls,
  trCls,
  type Tone,
} from "../ui";
import { ConfirmButton, formatDateTime, Hearts, n, useAction } from "./game-ui";

const CLAN_TONE: Record<ClanRow["status"], Tone> = {
  full: "positive",
  forming: "caution",
  disbanded: "neutral",
};

const PLAYER_TONE: Record<EnrolmentStatus, Tone> = {
  active: "positive",
  demoted: "caution",
  cheater: "danger",
};

const WAR_TONE: Record<WarStatus, Tone> = {
  proposed: "info",
  accepted: "info",
  live: "solid",
  judging: "caution",
  settled: "neutral",
  void: "neutral",
};

const WAR_WORD: Record<WarStatus, string> = {
  proposed: "Challenged",
  accepted: "Book open",
  live: "Live",
  judging: "Judging",
  settled: "Settled",
  void: "Void",
};

/** A `datetime-local` value for a moment, in the operator's own time zone. */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function anHourFromNow(): string {
  return toLocalInput(Date.now() + 60 * 60 * 1000);
}

/**
 * Every clan in the season, and the one lever an operator has over them:
 * setting two full clans a war without waiting for either to challenge.
 */
export function ClansTab() {
  const data = useAsync(() => gameApi.listClans(), []);
  const { note, busy, act } = useAction(data.reload);

  const clans = useMemo(() => data.data?.clans ?? [], [data.data]);
  const full = clans.filter((c) => c.status === "full").length;
  const forming = clans.filter((c) => c.status === "forming").length;
  const atWar = clans.filter((c) => c.war?.status === "live").length;

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`${cardCls} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}
      >
        <div className="p-5">
          <Stat label="Clans" value={n(clans.length)} hint="in the season" />
        </div>
        <div className="p-5">
          <Stat label="Full" value={n(full)} hint="both seats taken" />
        </div>
        <div className="p-5">
          <Stat label="Forming" value={n(forming)} hint="waiting on a second" />
        </div>
        <div className="p-5">
          <Stat label="At war now" value={n(atWar)} hint="clocks running" />
        </div>
      </div>

      <OrganiseWar
        clans={clans}
        loaded={Boolean(data.data)}
        busy={busy}
        note={note}
        onOrganise={(challenger, opponent, startsAt) =>
          act(
            () =>
              gameApi.organizeWar({
                challengerClanId: challenger.id,
                opponentClanId: opponent.id,
                startsAt,
              }),
            `Set ${challenger.name} against ${opponent.name}, starting ${formatDateTime(startsAt)}.`,
          )
        }
      />

      <Panel
        title="Clans"
        bleed
        aside={
          data.data && (
            <span className="tnum text-[11px] text-faint">
              {clans.length} {clans.length === 1 ? "clan" : "clans"}
            </span>
          )
        }
      >
        {data.loading && !data.data && (
          <div className="px-5">
            <Loading label="Loading clans" />
          </div>
        )}
        {data.error && (
          <div className="px-5">
            <ErrorNote message={data.error} />
          </div>
        )}
        {data.data && clans.length === 0 && (
          <Empty>
            No clans yet. Players form them from the game — a leader opens one
            and a second player joins with its invite code.
          </Empty>
        )}

        {clans.length > 0 && (
          <TableScroll>
            <table className={tableCls}>
              <thead>
                <tr className={theadCls}>
                  <th className={thCls}>Clan</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Members</th>
                  <th className={`${thCls} text-right`}>Nerve</th>
                  <th className={thCls}>Record</th>
                  <th className={thCls}>War</th>
                </tr>
              </thead>
              <tbody>
                {clans.map((clan) => (
                  <tr key={clan.id} className={trCls}>
                    <td className={tdCls}>
                      <span className="block font-bold">{clan.name}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-faint">
                        {clan.inviteCode}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <Badge tone={CLAN_TONE[clan.status]}>{clan.status}</Badge>
                    </td>
                    <td className={tdCls}>
                      {clan.members.length === 0 ? (
                        <span className="text-[11px] text-faint">No one</span>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {clan.members.map((m) => (
                            <Member key={m.enrolmentId} member={m} />
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className={`${tdCls} tnum text-right font-bold`}>
                      {n(clan.nerve)}
                    </td>
                    <td className={`${tdCls} tnum whitespace-nowrap text-muted`}>
                      {clan.warsWon} of {clan.warsFought} won
                    </td>
                    <td className={tdCls}>
                      {clan.war ? (
                        <span className="flex flex-col items-start gap-1">
                          <Badge tone={WAR_TONE[clan.war.status]}>
                            {WAR_WORD[clan.war.status]} v {clan.war.opponent}
                          </Badge>
                          <span className="whitespace-nowrap text-[11px] text-faint">
                            starts {formatDateTime(clan.war.startsAt)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </div>
  );
}

function Member({ member }: { member: ClanMemberRow }) {
  return (
    <li className="flex flex-wrap items-center gap-2 whitespace-nowrap">
      <span className="font-semibold">{member.handle}</span>
      {member.role === "leader" && (
        <span className="text-[11px] text-faint">
          leader
        </span>
      )}
      {member.status !== "active" && (
        <Badge tone={PLAYER_TONE[member.status]}>{member.status}</Badge>
      )}
      <Hearts remaining={member.heartsRemaining} total={member.heartsTotal} />
    </li>
  );
}

function OrganiseWar({
  clans,
  loaded,
  busy,
  note,
  onOrganise,
}: {
  clans: ClanRow[];
  loaded: boolean;
  busy: boolean;
  note: string | null;
  onOrganise: (challenger: ClanRow, opponent: ClanRow, startsAt: string) => Promise<void>;
}) {
  const [challengerId, setChallengerId] = useState("");
  const [opponentId, setOpponentId] = useState("");
  const [startsAt, setStartsAt] = useState(anHourFromNow);

  const eligible = clans.filter((c) => c.status === "full" && c.war === null);
  const challenger = eligible.find((c) => c.id === challengerId) ?? null;
  const opponents = eligible.filter((c) => c.id !== challengerId);
  const opponent = opponents.find((c) => c.id === opponentId) ?? null;
  const startMs = startsAt ? new Date(startsAt).getTime() : NaN;
  const tooFew = loaded && eligible.length < 2;
  const ready = Boolean(challenger && opponent && Number.isFinite(startMs));

  return (
    <Panel title="Organise a war">
      <p className="max-w-2xl text-[12px] leading-6 text-muted">
        This skips the challenge and opens the book immediately, both clans are
        told, and the start must be between 30 minutes and 7 days away.
      </p>

      {tooFew && (
        <p className="mt-3 text-[12px] leading-6 text-caution">
          {eligible.length === 0
            ? "No clan can be set a war right now — it takes two full clans that are not already in one."
            : "Only one clan is full and free right now — it takes two."}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <Field id="war-challenger" label="Challenger">
          <select
            id="war-challenger"
            value={challenger?.id ?? ""}
            disabled={tooFew || busy}
            onChange={(e) => {
              setChallengerId(e.target.value);
              if (e.target.value === opponentId) setOpponentId("");
            }}
            className={selectCls}
          >
            <option value="">Choose a clan</option>
            {eligible.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="war-opponent" label="Opponent">
          <select
            id="war-opponent"
            value={opponent?.id ?? ""}
            disabled={tooFew || busy}
            onChange={(e) => setOpponentId(e.target.value)}
            className={selectCls}
          >
            <option value="">Choose a clan</option>
            {opponents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="war-starts" label="Starts">
          <input
            id="war-starts"
            type="datetime-local"
            value={startsAt}
            disabled={tooFew || busy}
            onChange={(e) => setStartsAt(e.target.value)}
            className={`${inputCls} tnum`}
          />
        </Field>
        <ConfirmButton
          label="Set the war"
          confirmLabel="Press again to commit"
          tone="neutral"
          disabled={tooFew || busy || !ready}
          onConfirm={async () => {
            if (!challenger || !opponent || !Number.isFinite(startMs)) return;
            // The form is left as it was: on success both clans drop out of
            // the lists on reload, and on failure the operator can adjust.
            await onOrganise(challenger, opponent, new Date(startsAt).toISOString());
          }}
          className={btnPrimary}
        />
      </div>
      <p className="mt-2 text-[11px] leading-5 text-faint">
        Pressing twice commits both clans to a four-hour war.
      </p>

      {note && (
        <div className="mt-3 border-t border-line pt-3">
          <Note>{note}</Note>
        </div>
      )}
    </Panel>
  );
}
