# Archived screens

Features switched off but kept, so they can come back without being
rewritten. Nothing here is routed — `src/app/` is the only place Next.js
serves pages from — but it still type-checks, so it cannot rot unnoticed.

## `wars/` — clan wars (archived October 2026)

Two clans racing for four hours, with everyone else betting coins on it.
The backend refuses every way into a war (`CLAN_WARS_ARCHIVED` in
`backend/src/game/rules.ts`) and keeps every way out, so nothing left over
can strand anyone's coins. `src/lib/api/wars.ts` and the war hooks in
`src/lib/queries/social.ts` are kept for the same reason.

To bring wars back: flip `CLAN_WARS_ARCHIVED`, move `wars/` back to
`src/app/(app)/wars/`, and put the entry back in `PLACES` in
`src/components/nav.tsx`. Wars need clans, so bring those back first.

## `clan/` — clans (archived October 2026)

Two players, one leader, team tasks between them. The backend refuses
making, joining and team-task draws (`CLANS_ARCHIVED` in
`backend/src/game/rules.ts`); leaving still works, and a team task already
in hand still plays out. `src/lib/api/clans.ts` and the clan hooks in
`src/lib/queries/social.ts` are kept.

To bring clans back: flip `CLANS_ARCHIVED`, move `clan/` back to
`src/app/(app)/clan/`, and restore its row on `/me` and its slot in `PLACES`
(Me currently holds it).
