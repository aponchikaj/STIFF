# Archived screens

Switched off, kept so they can come back without being rewritten. Nothing
here is routed — only `src/app/` serves pages — but it still type-checks.

## `clans/` and `wars/` — clans and clan wars (archived October 2026)

The backend refuses every way *into* a clan or a war (`CLANS_ARCHIVED` and
`CLAN_WARS_ARCHIVED` in `backend/src/game/rules.ts`) and keeps every way
out: a member can leave, and the admin routes to settle or void a war still
answer, so a leftover war can always be finished and its stakes paid or
refunded. `ClansTab`, `WarsTab` and the clan/war calls in `src/lib/api/`
are kept for the same reason.

To bring them back: flip the two flags, move these folders back under
`src/app/`, restore the two sidebar entries in `src/components/chrome.tsx`,
and the "Wars stuck in judging" item in the overview's `NeedsAPerson`.
