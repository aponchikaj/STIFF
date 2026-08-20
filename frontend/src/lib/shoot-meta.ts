/**
 * "04 July 2026 — Tbilisi", with whichever halves exist.
 *
 * `shotOn` is a bare `YYYY-MM-DD` and is parsed at local midnight on purpose:
 * `new Date("2026-07-04")` is parsed as UTC, which renders as the 3rd for
 * anyone west of Greenwich and would date every shoot a day early.
 */
export function shootMeta(shoot: {
  shotOn: string | null;
  location: string | null;
}): string | null {
  const parts = [
    shoot.shotOn
      ? new Date(`${shoot.shotOn}T00:00:00`).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : null,
    shoot.location,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : null;
}
