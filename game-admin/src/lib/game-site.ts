/**
 * The game this panel operates — the player-facing site, not this origin.
 *
 * The panel links out to it, so pointing it at the wrong environment sends an
 * operator to production while they are testing. Defaults are per-environment
 * rather than a single constant for that reason.
 */
export const GAME_URL =
  process.env.NEXT_PUBLIC_GAME_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://stiff.co"
    : "http://localhost:3003");
