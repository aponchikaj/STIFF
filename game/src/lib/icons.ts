/**
 * The icon set, as types.
 *
 * Every file in `public/icons/` is listed here so an icon name is checked at
 * compile time rather than discovered as a 404 on a dark page where a
 * missing transparent webp looks exactly like a correct one.
 *
 * The art: 8px-grid pixel drawings, cyan on transparent, with CRT scanlines
 * and bloom already baked into the raster. That has two consequences for
 * every component that renders one.
 *
 *  - **Never resample them smoothly.** Always `image-rendering: pixelated`
 *    (the `pixelated` class, or `data-pixel`). A bilinear-scaled pixel icon
 *    turns to mush.
 *  - **Scale only by whole multiples of the source.** The art is drawn at
 *    ~150px for a 32px-class icon, so it downsamples cleanly to 16/24/32/48
 *    but fringes at 20 or 28. `ICON_SIZES` is that ladder.
 *
 * Because the glow is baked in, `icon-glow` is for *adding* bloom on hover
 * or focus, not for creating it. An un-glowed icon is already correct.
 */

export const ICON_NAMES = [
  "arrow-left",
  "arrow-right",
  "bandadge",
  "battery-empty",
  "battery-full",
  "battery-low",
  "battery-medium",
  "broken-heart",
  "camera",
  "cart",
  "chat",
  "close",
  "crown",
  "eye",
  "filled-heart",
  "fire",
  "fuckingaround",
  "game",
  "gift",
  "globe",
  "home",
  "just-trophy",
  "live",
  "location",
  "mail",
  "menu",
  "more",
  "notify",
  "opal",
  "outline-heart",
  "plus",
  "profile",
  "run",
  "search",
  "send",
  "settings",
  "skull",
  "star",
  "target",
  "trophy",
  "upload",
  "users",
  "video",
  "warning",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** The pressable button faces — these carry their own frame and label. */
export const BUTTON_ICON_NAMES = [
  "accept",
  "back",
  "decline",
  "next",
  "pause",
  "play",
] as const;

export type ButtonIconName = (typeof BUTTON_ICON_NAMES)[number];

/**
 * Width ÷ height, for the icons that are not square.
 *
 * Nearly all of them are drawn on a square canvas, so `size` can set both
 * dimensions. `opal` is not — it is a tall gemstone at 1211×1401 — and
 * forcing it square visibly squashes the one glyph standing in for the
 * currency. Anything listed here gets its height derived from its width.
 */
export const ICON_ASPECT: Partial<Record<IconName, number>> = {
  opal: 1211 / 1401,
};

/** Whole-multiple sizes only. See the note above about fringing. */
export const ICON_SIZES = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
  "2xl": 96,
} as const;

export type IconSize = keyof typeof ICON_SIZES;

export function iconSrc(name: IconName): string {
  return `/icons/${name}.webp`;
}

export function buttonIconSrc(name: ButtonIconName): string {
  return `/icons/buttons/${name}.webp`;
}

/**
 * What each icon is *for*, so a screen asks for a meaning and gets the
 * right file. Keeps `"fuckingaround"` and `"opal"` — which are brand marks,
 * not UI glyphs — from being picked by accident for a generic slot.
 */
export const ICON_ROLES = {
  /* navigation */
  home: "home",
  back: "arrow-left",
  forward: "arrow-right",
  menu: "menu",
  more: "more",
  close: "close",
  search: "search",
  settings: "settings",

  /* the game */
  play: "game",
  task: "target",
  live: "live",
  streak: "fire",
  run: "run",

  /* standing */
  heart: "filled-heart",
  heartEmpty: "outline-heart",
  heartBroken: "broken-heart",
  rank: "trophy",
  rankAlt: "just-trophy",
  leader: "crown",
  nerve: "star",
  cheater: "skull",

  /* economy — no coin file in the set; `opal` is the currency mark */
  coin: "opal",
  shop: "cart",
  reward: "gift",

  /* social */
  profile: "profile",
  clan: "users",
  comment: "chat",
  send: "send",
  notify: "notify",
  views: "eye",

  /* hand-in */
  camera: "camera",
  video: "video",
  upload: "upload",
  add: "plus",

  /* status */
  warning: "warning",
  injury: "bandadge",
  battery: "battery-full",
  batteryMid: "battery-medium",
  batteryLow: "battery-low",
  batteryEmpty: "battery-empty",

  /* misc */
  location: "location",
  mail: "mail",
  world: "globe",
} as const satisfies Record<string, IconName>;

export type IconRole = keyof typeof ICON_ROLES;

/** Prefer this over a bare name: `icon(ICON_ROLES.heart)` says why. */
export function roleIcon(role: IconRole): IconName {
  return ICON_ROLES[role];
}

/**
 * The heart row on the HUD: filled up to `remaining`, outline to `total`.
 * Returns names rather than elements so the caller controls the markup.
 */
export function heartRow(remaining: number, total: number): IconName[] {
  const safeTotal = Math.max(0, total);
  const safeRemaining = Math.min(Math.max(0, remaining), safeTotal);
  return Array.from({ length: safeTotal }, (_, i) =>
    i < safeRemaining ? "filled-heart" : "outline-heart",
  );
}

/** Battery as a four-step gauge — the set has exactly four states. */
export function batteryIcon(fraction: number): IconName {
  if (fraction <= 0.01) return "battery-empty";
  if (fraction < 0.34) return "battery-low";
  if (fraction < 0.67) return "battery-medium";
  return "battery-full";
}
