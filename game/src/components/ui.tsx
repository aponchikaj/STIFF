"use client";

/**
 * The primitives.
 *
 * **Nothing is in a box.** No borders, no outlines, no cards. The reference
 * sheet draws frames around its buttons; we do not. Hierarchy here comes
 * from four things and only these four:
 *
 *   1. **Light.** A thing that matters emits more. Bloom is the primary
 *      affordance — hover and focus brighten rather than outline.
 *   2. **Scale.** The type ladder does the shouting.
 *   3. **Space.** Black is the separator. Generous, unapologetic.
 *   4. **The marker.** `▶` from the nav sheet points at what is selected.
 *      It is the one ornament that survives.
 *
 * Where a region genuinely has to read as a distinct surface, it gets a
 * scanline band or a single hairline rule — never four sides of anything.
 */

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import type { IconName } from "@/lib/icons";

/* ================================================================== type */

type DisplaySize = "sm" | "hero" | "title" | "mega" | "colossal";

/**
 * The display ladder.
 *
 * Two departures from a naive reading of the type board, both forced by
 * reality rather than taste:
 *
 * **Clamped, not fixed.** The board specifies one tier — 320–599px, where
 * hero is 32px. Those numbers are the *upper* anchor here and the clamp
 * floor keeps a heading inside a narrow column instead of overflowing it.
 *
 * **Leading is ~1, not 0.875.** The board's 32/28 is a sub-1 ratio, which
 * is correct for PPNeueBit — a compact em box — on a single line. Press
 * Start 2P, the fallback until that licence lands, has a much taller em
 * box, and 0.875 makes any heading that wraps collide with itself. A ratio
 * just over 1 looks the same on one line and survives two. Revisit once
 * the real face is installed.
 */
const displaySizes: Record<DisplaySize, string> = {
  sm: "text-[clamp(15px,3.5vw,20px)] leading-[1.1]",
  hero: "text-[clamp(20px,4.5vw,32px)] leading-[1.05]",
  title: "text-[clamp(24px,5.5vw,48px)] leading-[1.03]",
  mega: "text-[clamp(34px,8vw,72px)] leading-[1]",
  colossal: "text-[clamp(44px,12vw,112px)] leading-[0.95]",
};

/**
 * A heading in the display face.
 *
 * `scanlines` bakes the CRT banding into the letterforms the way the
 * wordmark does. It costs legibility, so it is off by default and belongs
 * on the biggest type only.
 */
export function Display({
  children,
  size = "hero",
  scanlines = false,
  tone = "bone",
  className,
}: {
  children: ReactNode;
  size?: DisplaySize;
  scanlines?: boolean;
  tone?: "bone" | "cyan" | "blue" | "muted";
  className?: string;
}) {
  const tones = {
    bone: "text-ink text-glow",
    cyan: "text-cyan text-glow-cyan",
    blue: "text-blue text-glow-blue",
    muted: "text-ink-faint",
  } as const;

  return (
    <span
      className={cn(
        // `text-balance` so a two-line heading splits evenly instead of
        // leaving one orphaned word on the second line.
        "inline-block text-balance font-display uppercase pixel-snap",
        displaySizes[size],
        tones[tone],
        scanlines && "scanlines-coarse",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A caption or field label. 12/16, letter-spaced, blue. */
export function Label({
  children,
  tone = "blue",
  className,
}: {
  children: ReactNode;
  tone?: "blue" | "muted" | "faint" | "coin" | "heart" | "good" | "caution";
  className?: string;
}) {
  const tones = {
    blue: "text-blue",
    muted: "text-ink-muted",
    faint: "text-ink-faint",
    coin: "text-coin",
    heart: "text-heart",
    good: "text-good",
    caution: "text-caution",
  } as const;

  return (
    <span
      className={cn(
        "font-body text-caption leading-4 uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Body copy. The only thing on the page not in uppercase. */
export function Body({
  children,
  size = "md",
  className,
}: {
  children: ReactNode;
  size?: "md" | "sm";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-body text-ink-muted",
        size === "md" ? "text-body leading-[22px]" : "text-body-sm leading-[18px]",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ================================================================ button */

type ButtonVariant = "primary" | "quiet" | "danger" | "coin" | "good";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** The ▶ from the nav sheet. On by default for `primary` — it is how a
   *  borderless control says "this is the one". */
  marker?: boolean;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * Colour at rest, and what brightening looks like.
 *
 * Every variant lifts to a brighter ink *and* a bigger text-shadow on
 * hover. With no border to change, the glow is the entire state machine —
 * which is why `transition-all` rather than `transition-colors`.
 */
const buttonTones: Record<ButtonVariant, string> = {
  primary:
    "text-ink [text-shadow:var(--glow-blue)] hover:text-cyan hover:[text-shadow:var(--glow-cyan-lg)]",
  quiet:
    "text-ink-faint hover:text-ink hover:[text-shadow:var(--glow-bone)]",
  danger:
    "text-heart [text-shadow:var(--glow-heart)] hover:text-danger hover:[text-shadow:0_0_6px_rgb(255_59_48/1),0_0_22px_rgb(255_59_48/0.7)]",
  coin: "text-coin [text-shadow:var(--glow-coin)] hover:[text-shadow:0_0_6px_rgb(255_194_39/1),0_0_24px_rgb(255_194_39/0.7)]",
  good: "text-good [text-shadow:0_0_4px_rgb(47_217_107/0.9),0_0_14px_rgb(47_217_107/0.5)]",
};

const buttonSizes: Record<ButtonSize, string> = {
  // Pixel type is legible at these three and fringes between them.
  // `min-h` is the 44px touch target — this is played on a phone.
  sm: "text-[9px] leading-3 gap-2 py-2 min-h-9",
  md: "text-[12px] leading-4 gap-2.5 py-3 min-h-11",
  lg: "text-[16px] leading-6 gap-3 py-4 min-h-14",
};

/**
 * A button that is text and nothing else.
 *
 * No border, no fill, no outline — the press is a scale snap, the state is
 * the glow. `focus-visible` still draws the global cyan ring, because
 * removing the border must not remove keyboard affordance too.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    marker,
    icon,
    loading = false,
    fullWidth = false,
    className,
    disabled,
    ...props
  },
  ref,
) {
  const inert = disabled || loading;
  const showMarker = marker ?? variant === "primary";

  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={inert}
      whileTap={inert ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.08 }}
      className={cn(
        "group relative inline-flex items-center justify-center",
        "bg-transparent font-pixel uppercase tracking-[0.12em]",
        "transition-all duration-200",
        "disabled:opacity-30 disabled:pointer-events-none",
        buttonTones[variant],
        buttonSizes[size],
        fullWidth ? "w-full" : "px-1",
        className,
      )}
      {...props}
    >
      {showMarker ? (
        <span
          aria-hidden
          // Hidden until wanted, then slides in. A marker that is always
          // visible stops meaning "this one".
          className="inline-block w-2 -translate-x-1 text-cyan opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
        >
          ▶
        </span>
      ) : null}

      {icon && !loading ? (
        <Icon name={icon} size={size === "lg" ? "md" : "sm"} glow />
      ) : null}

      {loading ? (
        <span className="animate-[blink_0.7s_steps(2,end)_infinite]">▮▮▮</span>
      ) : (
        children
      )}
    </motion.button>
  );
});

/** A bare icon with a hit area. For close, back, like, share. */
export function IconButton({
  name,
  label,
  size = "sm",
  tone,
  active,
  className,
  ...props
}: {
  name: IconName;
  /** Required — an icon alone has no accessible name. */
  label: string;
  size?: "sm" | "md";
  tone?: "heart" | "coin";
  active?: boolean;
  className?: string;
} & Omit<HTMLMotionProps<"button">, "children">) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={active}
      whileTap={{ scale: 0.88 }}
      transition={{ duration: 0.08 }}
      className={cn(
        "inline-flex items-center justify-center p-2 transition-opacity",
        active ? "opacity-100" : "opacity-60 hover:opacity-100",
        className,
      )}
      {...props}
    >
      <Icon
        name={name}
        size={size === "md" ? "md" : "sm"}
        glow={active ? (tone ?? true) : undefined}
        dim={!active && !tone}
      />
    </motion.button>
  );
}

/* =============================================================== surface */

/**
 * A region that needs to read as its own surface.
 *
 * Not a card — there is no border and no corner. It separates by being a
 * shade off pure black with the CRT banding running through it, which is
 * how a real screen distinguishes a panel from the void behind it.
 */
export function Panel({
  children,
  className,
  scanlines = true,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  scanlines?: boolean;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative bg-surface-2/60",
        scanlines && "scanlines",
        glow && "shadow-[inset_0_0_60px_rgb(1_163_255/0.08)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A hairline. The only line in the system.
 *
 * Solid edge to edge, one device pixel thick. It used to fade out at both
 * ends, which on a black page meant only the middle third was ever visible
 * and the line read as a smudge rather than an edge. A `0.5px` border is a
 * true hairline on a retina screen and snaps up to 1px on a 1x one, where a
 * `0.5px` *height* would simply vanish.
 */
export function Rule({
  className,
  tone = "dim",
}: {
  className?: string;
  tone?: "dim" | "blue";
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "w-full border-t-[0.5px]",
        tone === "blue" ? "border-blue/70" : "border-blue-dim",
        className,
      )}
    />
  );
}

/* =================================================================== HUD */

/**
 * The heart, drawn on its own 9×8 pixel grid rather than taken from the
 * icon sheet.
 *
 * The sheet's hearts were the wrong tool for a life counter: blue, while
 * every token and comment here calls a heart red; the glyph filled barely a
 * third of its raster, so a "24px" heart was ~8px of heart and 16px of baked
 * glow; and a spent one was an outline then greyed to 35% brightness, which
 * on black is close to nothing. They stay on the sheet for the feed's like
 * button, where blue is right.
 *
 * `#` is the body, `+` the highlight that makes it read as lit rather than
 * flat. A spent heart keeps only its edge cells — computed, so the outline
 * can never drift from the shape — in the dim red, over a faint fill so
 * the slot still reads as a heart and not as a gap.
 */
const HEART_ROWS = [
  ".##...##.",
  "#++#.####",
  "#+#######",
  "#########",
  ".#######.",
  "..#####..",
  "...###...",
  "....#....",
] as const;

const HEART_W = HEART_ROWS[0].length;
const HEART_H = HEART_ROWS.length;

function heartFilled(x: number, y: number): boolean {
  const ch = HEART_ROWS[y]?.[x];
  return ch === "#" || ch === "+";
}

function heartPath(test: (x: number, y: number, ch: string) => boolean): string {
  let d = "";
  HEART_ROWS.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (test(x, y, ch)) d += `M${x} ${y}h1v1h-1z`;
    });
  });
  return d;
}

const HEART_BODY = heartPath((_, __, ch) => ch === "#");
const HEART_SHINE = heartPath((_, __, ch) => ch === "+");
const HEART_ALL = heartPath((x, y) => heartFilled(x, y));
const HEART_EDGE = heartPath(
  (x, y) =>
    heartFilled(x, y) &&
    (!heartFilled(x - 1, y) ||
      !heartFilled(x + 1, y) ||
      !heartFilled(x, y - 1) ||
      !heartFilled(x, y + 1)),
);

/**
 * One heart. `size` is the height it aims for; the actual scale is rounded
 * to a whole number of screen pixels per grid cell, because a pixel heart
 * at 2.67px per cell renders with uneven, smeared rows.
 */
export function PixelHeart({
  alive,
  size = 16,
  className,
}: {
  alive: boolean;
  size?: number;
  className?: string;
}) {
  const scale = Math.max(1, Math.round(size / HEART_H));
  return (
    <svg
      aria-hidden
      width={HEART_W * scale}
      height={HEART_H * scale}
      viewBox={`0 0 ${HEART_W} ${HEART_H}`}
      shapeRendering="crispEdges"
      className={cn("block", alive && "icon-glow-heart", className)}
    >
      {alive ? (
        <>
          <path d={HEART_BODY} className="fill-heart" />
          <path d={HEART_SHINE} fill="#ffd3d8" />
        </>
      ) : (
        <>
          <path d={HEART_ALL} className="fill-heart" fillOpacity={0.07} />
          <path d={HEART_EDGE} className="fill-heart-dim" />
        </>
      )}
    </svg>
  );
}

/**
 * The heart row.
 *
 * Announced as one thing ("2 of 3 hearts"); a screen reader enumerating
 * five heart images one at a time is useless. Spent hearts stay in place
 * and go dark — a row that shrinks hides what was lost.
 */
export function Hearts({
  remaining,
  total,
  size = 24,
  className,
}: {
  remaining: number;
  total: number;
  size?: number;
  className?: string;
}) {
  const safeTotal = Math.max(0, total);
  const safeRemaining = Math.min(Math.max(0, remaining), safeTotal);

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="img"
      aria-label={`${safeRemaining} of ${safeTotal} hearts`}
    >
      {Array.from({ length: safeTotal }, (_, index) => {
        const alive = index < safeRemaining;
        return (
          <motion.span
            key={index}
            initial={false}
            animate={alive ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0.9 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <PixelHeart alive={alive} size={size} />
          </motion.span>
        );
      })}
    </div>
  );
}

type StatTone = "default" | "coin" | "heart" | "cyan" | "good";

/**
 * Two glow tiers per tone, picked by size.
 *
 * A stat value is often a single narrow glyph — a `0`, a `#1` — and the
 * display-scale glow turns one of those into a featureless ball of light.
 * Below `lg` the tight tier is the only legible choice.
 */
const statTones: Record<StatTone, { small: string; large: string }> = {
  default: { small: "text-ink text-glow-xs", large: "text-ink text-glow" },
  coin: { small: "text-coin text-glow-coin-xs", large: "text-coin text-glow-coin" },
  heart: { small: "text-heart text-glow-heart-xs", large: "text-heart text-glow-heart" },
  cyan: { small: "text-cyan text-glow-cyan-xs", large: "text-cyan text-glow-cyan" },
  good: { small: "text-good", large: "text-good" },
};

/** A labelled number: coins, Nerve, rank, a count. */
export function Stat({
  icon,
  value,
  label,
  tone = "default",
  size = "md",
  className,
}: {
  icon?: IconName;
  value: ReactNode;
  label?: string;
  tone?: StatTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const valueSize = {
    sm: "text-[10px] leading-4",
    md: "text-[14px] leading-5",
    lg: "text-[20px] leading-7",
  }[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {icon ? (
        <Icon
          name={icon}
          size={size === "lg" ? "md" : "sm"}
          glow={tone === "coin" ? "coin" : tone === "heart" ? "heart" : true}
        />
      ) : null}
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "font-pixel tabular-nums",
            valueSize,
            size === "lg" ? statTones[tone].large : statTones[tone].small,
          )}
        >
          {value}
        </span>
        {label ? <Label tone="faint">{label}</Label> : null}
      </div>
    </div>
  );
}

/* ================================================================ dialog */

interface DialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  busy?: boolean;
}

/**
 * The ARE YOU SURE? box — without the box.
 *
 * The reference draws a bordered dialog. Here the backdrop does that job:
 * everything behind goes black and blurs, and the question is simply the
 * only lit thing left on the screen. Escape and the backdrop both cancel,
 * because a confirmation whose only exit is "No" traps anyone who opened
 * it by accident.
 */
export function Dialog({
  open,
  title,
  children,
  confirmLabel = "YES",
  cancelLabel = "NO",
  onConfirm,
  onCancel,
  destructive = false,
  busy = false,
}: DialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-void/92 backdrop-blur-md"
        onClick={onCancel}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex w-full max-w-md flex-col items-center gap-6 text-center"
      >
        <p className="font-pixel text-[16px] leading-6 uppercase tracking-[0.1em] text-ink text-glow">
          {title}
        </p>

        {children ? <Body size="sm" className="max-w-sm">{children}</Body> : null}

        <div className="mt-2 flex items-center gap-10">
          <Button
            marker
            size="md"
            variant={destructive ? "danger" : "primary"}
            loading={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button size="md" variant="quiet" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ================================================================ states */

/** The blinking cursor that stands in for everything still loading. */
export function Loading({ label = "LOADING" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10">
      <span className="font-pixel text-[10px] uppercase tracking-[0.12em] text-blue">
        {label}
      </span>
      <span className="animate-[blink_0.7s_steps(2,end)_infinite] font-pixel text-[10px] text-cyan">
        ▮
      </span>
    </div>
  );
}

/** Nothing here yet. An icon, a line, and no apology. */
export function Empty({
  icon = "fuckingaround",
  title,
  children,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-20 text-center">
      <Icon name={icon} size="xl" className="opacity-25" />
      <p className="font-pixel text-[12px] uppercase tracking-[0.12em] text-ink-faint">
        {title}
      </p>
      {children ? <Body size="sm" className="max-w-xs">{children}</Body> : null}
    </div>
  );
}

/** Something went wrong, said plainly. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="font-body text-caption leading-4 uppercase tracking-[0.1em] text-danger [text-shadow:var(--glow-danger)]"
    >
      {children}
    </p>
  );
}

/* ================================================================ layout */

/** The spec grid: 4 / 8 / 12 columns, 16px gutter. */
export function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid-stiff", className)}>{children}</div>;
}

/** Standard page padding and max width, so screens line up with each other. */
export function Screen({
  children,
  className,
  width = "md",
}: {
  children: ReactNode;
  className?: string;
  width?: "sm" | "md" | "lg" | "full";
}) {
  const widths = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-5xl",
    full: "max-w-none",
  } as const;

  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6", widths[width], className)}>
      {children}
    </div>
  );
}

/** A screen's heading block: eyebrow, title, optional line under it. */
export function PageHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 pb-8 pt-10">
      {eyebrow ? <Label>{eyebrow}</Label> : null}
      <Display size="title">{title}</Display>
      {children ? <Body size="sm" className="max-w-md">{children}</Body> : null}
    </header>
  );
}
