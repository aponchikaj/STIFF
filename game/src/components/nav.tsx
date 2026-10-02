"use client";

/**
 * The chrome. Two layouts, one set of destinations.
 *
 * **From `md` (905px): one top bar and nothing else.**
 *
 *     FEED  BOARD  WARS  SHOP  |  ▶ PLAY  |  ♥♥♡ ★ 12.5K ◆ 3,820  [▣ HANDLE]
 *                                                              PLAYER · #14
 *
 * Places on the left, the one action in the middle, *you* on the right —
 * the three questions a screen answers (where can I go, what do I do, how
 * am I doing) in reading order. A bottom bar on a desktop is a phone
 * pattern with nothing to gain: there is no thumb to reach it with.
 *
 * **Below `md`: a status strip on top and a tab bar at the bottom.** The
 * tab bar holds four places with the action raised in the middle of them —
 * the thumb's resting point, and the one control drawn unlike the others.
 *
 * **The action is role-aware.** A player's is PLAY. A watcher cannot play;
 * what a watcher *does* is vote on players' hand-ins, so their button is
 * VOTE. Same position, same weight, the verb that applies to them.
 *
 * **"You" is not a tab.** The identity in the status strip is the way to
 * the profile, and the profile is where the rest lives — clan, votes,
 * purchases, reports. Six tabs at 320px is six cramped tabs; five with a
 * raised middle is a layout.
 *
 * Every bar is borderless: held off the content by a scanline band and the
 * shared `Rule`, with the current place marked by light — a lit label and
 * a short glowing underline that slides between places (`layoutId`).
 */

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Icon } from "./icon";
import { Hearts, Label, Rule } from "./ui";
import type { EnrolmentView } from "@/lib/api";
import type { IconName } from "@/lib/icons";
import { useAuthState, useDashboard } from "@/lib/queries";
import { cn, formatCompact } from "@/lib/utils";

/* ------------------------------------------------------------- places */

interface Place {
  href: string;
  label: string;
  icon: IconName;
}

/** Where you can go. The order is the order on screen, everywhere. */
const PLACES: Place[] = [
  { href: "/feed", label: "Feed", icon: "live" },
  { href: "/board", label: "Board", icon: "trophy" },
  { href: "/wars", label: "Wars", icon: "fire" },
  { href: "/shop", label: "Shop", icon: "cart" },
];

interface Action {
  href: string;
  label: string;
  icon: IconName;
}

/** What you do here. A watcher votes; everyone else is pointed at play. */
function actionFor(enrolment: EnrolmentView | null | undefined): Action {
  return enrolment?.role === "watcher"
    ? { href: "/vote", label: "Vote", icon: "eye" }
    : { href: "/play", label: "Play", icon: "game" };
}

function isActive(pathname: string, href: string): boolean {
  // Prefix match so /wars/<id> keeps Wars lit, but "/" never matches all.
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* ---------------------------------------------------------- formatting */

/**
 * Exact below ten thousand, compact above it. "3,820" is a number a player
 * can budget against; "3.8K" hides the two hundred they are short by. Past
 * five digits the precision stops mattering and the width starts to.
 */
function formatHud(value: number): string {
  return Math.abs(value) < 10_000
    ? new Intl.NumberFormat("en-US").format(value)
    : formatCompact(value);
}

const ROLE_WORD = { player: "Player", watcher: "Watcher" } as const;

/* ---------------------------------------------------------- the trigger */

/**
 * Whether a phone has scrolled far enough to tuck the identity row away.
 *
 * An external store rather than state set from an effect, so the value is
 * read during render and the server render (never scrolled) agrees with
 * the first client render. Hysteresis — collapse past 64px, expand only
 * back above 8px — because the strip is sticky and in flow: collapsing it
 * shortens the page, and on a page that barely scrolls one threshold would
 * have the browser clamp the scroll back under it and flap forever.
 */
let identityTucked = false;

function subscribeTucked(onChange: () => void): () => void {
  const update = () => {
    const y = window.scrollY;
    const next = identityTucked ? y > 8 : y > 64;
    if (next !== identityTucked) {
      identityTucked = next;
      onChange();
    }
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
  return () => window.removeEventListener("scroll", update);
}

function useIdentityTucked(): boolean {
  return useSyncExternalStore(
    subscribeTucked,
    () => identityTucked,
    () => false,
  );
}

/* ================================================================ top */

/**
 * The top of every in-game screen: the full bar from `md`, the status
 * strip below it. Exported under its old name so the layout did not move.
 */
export function StatusStrip() {
  const { data } = useDashboard();
  const { isSignedIn, isResolved } = useAuthState();
  const enrolment = data?.enrolment ?? null;

  return (
    <header className="sticky top-0 z-40 bg-void/85 backdrop-blur-md">
      <DesktopBar
        enrolment={enrolment}
        rank={data?.rank ?? null}
        isSignedIn={isSignedIn}
        isResolved={isResolved}
      />
      <MobileStrip
        enrolment={enrolment}
        rank={data?.rank ?? null}
        isSignedIn={isSignedIn}
        isResolved={isResolved}
      />
      <Rule />
    </header>
  );
}

interface BarProps {
  enrolment: EnrolmentView | null;
  rank: number | null;
  isSignedIn: boolean;
  isResolved: boolean;
}

/* --------------------------------------------------------- desktop bar */

/**
 * A true three-column grid (`1fr auto 1fr`), not a flex row with
 * `justify-between`: the action must sit at the centre of the *screen*,
 * whatever the widths of the two sides, or it drifts every time a balance
 * gains a digit.
 */
function DesktopBar({ enrolment, rank, isSignedIn, isResolved }: BarProps) {
  const pathname = usePathname();
  const action = actionFor(enrolment);

  return (
    <div className="scanlines mx-auto hidden h-[68px] w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-6 md:grid lg:gap-6 lg:px-8">
      <nav
        aria-label="Main"
        className="flex min-w-0 items-center gap-1 lg:gap-2"
      >
        {PLACES.map((place) => {
          const active = isActive(pathname, place.href);
          return (
            <Link
              key={place.href}
              href={place.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-[68px] items-center px-2 font-pixel text-[10px] uppercase tracking-[0.12em] transition-colors lg:px-3 lg:text-[11px]",
                active
                  ? "text-cyan text-glow-cyan-xs"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {place.label}
              <AnimatePresence>
                {active ? (
                  <motion.span
                    layoutId="desktop-place-marker"
                    aria-hidden
                    className="absolute inset-x-2 bottom-0 h-px bg-cyan shadow-[var(--glow-cyan)] lg:inset-x-3"
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  />
                ) : null}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      <ActionButton action={action} active={isActive(pathname, action.href)} />

      <div className="flex min-w-0 items-center justify-end gap-3 lg:gap-4">
        {enrolment ? (
          <>
            <DesktopStats enrolment={enrolment} />
            <span aria-hidden className="h-8 w-px shrink-0 bg-blue-dim" />
            <Identity enrolment={enrolment} rank={rank} size="desktop" />
          </>
        ) : isResolved ? (
          <SignedOutActions isSignedIn={isSignedIn} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * The action, on the desktop bar. The only filled control in the chrome —
 * a notched blue-dim plate with a cyan label — so it reads as *the* thing
 * to press without being louder than the content under it.
 */
function ActionButton({ action, active }: { action: Action; active: boolean }) {
  return (
    <Link
      href={action.href}
      aria-current={active ? "page" : undefined}
      className="group bloom-blue-sm block transition-[filter] duration-200 hover:[filter:drop-shadow(0_0_3px_rgb(1_231_255/1))_drop-shadow(0_0_14px_rgb(1_231_255/0.7))_drop-shadow(0_0_30px_rgb(1_231_255/0.35))]"
    >
      <span className="frame-notch block bg-blue p-px">
        <span
          className={cn(
            "frame-notch flex h-11 items-center gap-2.5 px-4 transition-colors lg:px-6",
            active ? "bg-blue-deep" : "bg-blue-dim group-hover:bg-blue-deep",
          )}
        >
          <Icon name={action.icon} size="xs" glow />
          <span className="font-pixel text-[13px] uppercase tracking-[0.14em] text-ink text-glow-cyan-xs">
            {action.label}
          </span>
        </span>
      </span>
    </Link>
  );
}

/**
 * Hearts, Nerve and Opals in one notched plate with hairline dividers:
 * three numbers that belong together read as one instrument, not three
 * loose boxes. Each keeps its caption — a star and a gem are not
 * self-explanatory on day one — and Nerve and Opals are links to where
 * you would go about them.
 */
function DesktopStats({ enrolment }: { enrolment: EnrolmentView }) {
  const isPlayer = enrolment.role === "player";
  return (
    <div className="frame-notch shrink-0 bg-blue-dim/70 p-px">
      <div className="frame-notch flex h-12 items-stretch bg-surface-2">
        {isPlayer ? (
          <DesktopStat label="Hearts">
            <Hearts
              remaining={enrolment.heartsRemaining}
              total={enrolment.heartsTotal}
              size={16}
              className="gap-1"
            />
          </DesktopStat>
        ) : null}
        <DesktopStat
          label="Nerve"
          icon="star"
          tone="cyan"
          href="/board"
          divided={isPlayer}
        >
          {formatHud(enrolment.nerve)}
        </DesktopStat>
        <DesktopStat
          label="Opals"
          icon="opal"
          tone="coin"
          href="/shop#opals"
          divided
        >
          {formatHud(enrolment.coins)}
        </DesktopStat>
      </div>
    </div>
  );
}

function DesktopStat({
  label,
  icon,
  tone,
  href,
  divided = false,
  children,
}: {
  label: string;
  icon?: IconName;
  tone?: "cyan" | "coin";
  href?: string;
  divided?: boolean;
  children: ReactNode;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5">
        {icon ? (
          <Icon name={icon} size={12} glow={tone === "coin" ? "coin" : true} />
        ) : null}
        <Label tone="muted" className="text-[10px] leading-3 font-semibold">
          {label}
        </Label>
      </span>
      <span
        className={cn(
          "flex h-4 items-center font-pixel text-[13px] leading-4 tabular-nums",
          tone === "cyan" && "text-cyan text-glow-cyan-xs",
          tone === "coin" && "text-coin text-glow-coin-xs",
        )}
      >
        {children}
      </span>
    </>
  );
  const cls = cn(
    "flex flex-col justify-center gap-1 px-2.5 lg:px-3.5",
    divided && "border-l border-blue-dim/70",
    href && "transition-colors hover:bg-surface-3",
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ---------------------------------------------------------- identity */

/**
 * Who you are: a framed role glyph, the handle, and the status under it.
 *
 * The handle fits itself to the width it is given — Press Start is 1em per
 * glyph plus the 0.06em tracking, so the column width over (glyphs × 1.06)
 * is the size that fills one line exactly. Capped at 13/14px, floored at
 * 10px, and only below that an ellipsis (`title` and /me carry the rest).
 * `container-type` gives the column no content width of its own, which is
 * why it must be `flex-1` — it takes space rather than asking for it.
 *
 * The status line says what the game says about you: player or watcher,
 * your rank, and — in red, ahead of everything — CHEATER.
 */
function Identity({
  enrolment,
  rank,
  size,
}: {
  enrolment: EnrolmentView;
  rank: number | null;
  size: "desktop" | "mobile";
}) {
  const isPlayer = enrolment.role === "player";
  const isCheater = enrolment.status === "cheater";
  const desktop = size === "desktop";

  return (
    <Link
      href="/me"
      title={enrolment.handle}
      className={cn(
        "group flex min-w-0 items-center gap-3",
        // From `md` to `lg` only the framed glyph shows: the bar cannot
        // fit the handle beside three stats and four places at 905px.
        desktop
          ? "shrink-0 lg:max-w-[16rem] lg:min-w-0 lg:flex-1 lg:shrink"
          : "w-full",
      )}
    >
      <span className="bloom-blue-sm shrink-0 transition-[filter] duration-200 group-hover:[filter:drop-shadow(0_0_2px_rgb(1_231_255/0.95))_drop-shadow(0_0_8px_rgb(1_231_255/0.65))_drop-shadow(0_0_22px_rgb(1_231_255/0.35))]">
        <span className="frame-notch block bg-blue-dim p-px">
          <span
            className={cn(
              "frame-notch flex items-center justify-center bg-surface-3",
              desktop ? "size-10" : "size-9",
            )}
          >
            <Icon name={isPlayer ? "run" : "eye"} size="sm" glow />
          </span>
        </span>
      </span>

      <span
        className={cn(
          "min-w-0 flex-1 flex-col gap-1.5 [container-type:inline-size]",
          desktop ? "hidden lg:flex" : "flex",
        )}
        style={
          {
            "--handle-em": enrolment.handle.length * 1.06 + 0.5,
          } as CSSProperties
        }
      >
        <span
          className={cn(
            "block truncate font-pixel leading-4 uppercase tracking-[0.06em] text-ink text-glow-xs transition-colors group-hover:text-cyan-pale",
            desktop
              ? "text-[length:min(13px,max(10px,calc(100cqw/var(--handle-em))))]"
              : "text-[length:min(14px,max(10px,calc(100cqw/var(--handle-em))))]",
          )}
        >
          {enrolment.handle}
        </span>
        <span
          className={cn(
            "flex min-w-0 items-center gap-x-2 gap-y-1",
            desktop ? "flex-nowrap whitespace-nowrap" : "flex-wrap",
          )}
        >
          {isCheater ? (
            <span className="font-pixel text-[9px] leading-[14px] uppercase tracking-[0.1em] text-danger [text-shadow:var(--glow-danger)]">
              Cheater
            </span>
          ) : (
            <Label
              tone={isPlayer ? "blue" : "muted"}
              className="text-[11px] leading-[14px] font-semibold"
            >
              {ROLE_WORD[enrolment.role]}
            </Label>
          )}
          {rank !== null ? (
            <>
              <span aria-hidden className="size-[3px] bg-ink-faint" />
              <Label
                tone="muted"
                className="text-[11px] leading-[14px] font-semibold"
              >
                {desktop ? null : "Rank "}
                <span className="text-ink tabular-nums">#{rank}</span>
              </Label>
            </>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

/**
 * The right-hand side when there is no enrolment to show. Signed out, the
 * two ways in; signed in but not in this season, the way to join.
 */
function SignedOutActions({ isSignedIn }: { isSignedIn: boolean }) {
  if (isSignedIn) {
    return (
      <div className="flex items-center gap-5">
        <Link
          href="/me"
          className="font-pixel text-[10px] uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink"
        >
          Account
        </Link>
        <Link
          href="/join"
          className="font-pixel text-[11px] uppercase tracking-[0.12em] text-cyan text-glow-cyan-xs transition-colors hover:text-cyan-pale"
        >
          Join season
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-5">
      <Link
        href="/login"
        className="font-pixel text-[10px] uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink"
      >
        Sign in
      </Link>
      <Link
        href="/join"
        className="font-pixel text-[11px] uppercase tracking-[0.12em] text-cyan text-glow-cyan-xs transition-colors hover:text-cyan-pale"
      >
        Join
      </Link>
    </div>
  );
}

/* ---------------------------------------------------------- mobile top */

/**
 * The status strip, below `md`: identity, then three labelled cells.
 *
 * Once the page scrolls the identity row tucks away, leaving only the
 * numbers — the part that changes while you play — so the strip costs
 * ~62px of a small screen instead of ~120. Back at the top it returns.
 *
 * With no enrolment there are no numbers to show, so the strip becomes a
 * slim bar with the way in: the bottom bar has no "You" tab, and this must
 * never leave someone with no route to sign in.
 */
function MobileStrip({ enrolment, rank, isSignedIn, isResolved }: BarProps) {
  const tucked = useIdentityTucked();

  if (!enrolment) {
    return (
      <div className="scanlines flex h-12 items-center justify-between px-4 md:hidden">
        <Link
          href="/"
          className="font-pixel text-[13px] uppercase tracking-[0.18em] text-ink text-glow-xs"
        >
          Stiff
        </Link>
        {isResolved ? <SignedOutActions isSignedIn={isSignedIn} /> : null}
      </div>
    );
  }

  const isPlayer = enrolment.role === "player";

  return (
    <div className="scanlines flex flex-col px-4 py-2.5 sm:px-6 md:hidden">
      {/* `grid-rows` 1fr → 0fr is the one height transition that needs no
          measured height. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-arcade)]",
          tucked ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
        )}
        aria-hidden={tucked || undefined}
        inert={tucked || undefined}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-2.5">
            <Identity enrolment={enrolment} rank={rank} size="mobile" />
          </div>
        </div>
      </div>

      <div className="flex w-full items-stretch gap-2 sm:gap-2.5">
        {isPlayer ? (
          <HudCell label="Hearts" tone="heart">
            {/* 16 → 2px per grid cell → 18×16 of actual heart. */}
            <Hearts
              remaining={enrolment.heartsRemaining}
              total={enrolment.heartsTotal}
              size={16}
              className="gap-1"
            />
          </HudCell>
        ) : null}
        <HudCell label="Nerve" icon="star" tone="cyan" href="/board">
          {formatHud(enrolment.nerve)}
        </HudCell>
        <HudCell label="Opals" icon="opal" tone="coin" href="/shop#opals">
          {formatHud(enrolment.coins)}
        </HudCell>
      </div>
    </div>
  );
}

type HudTone = "heart" | "cyan" | "coin";

const HUD_TONES: Record<HudTone, { value: string; bloom: string }> = {
  heart: {
    value: "text-heart text-glow-heart",
    bloom:
      "group-hover:[filter:drop-shadow(0_0_2px_rgb(255_77_94/0.9))_drop-shadow(0_0_10px_rgb(255_77_94/0.5))]",
  },
  cyan: {
    value: "text-cyan text-glow-cyan",
    bloom:
      "group-hover:[filter:drop-shadow(0_0_2px_rgb(1_231_255/0.95))_drop-shadow(0_0_8px_rgb(1_231_255/0.6))]",
  },
  coin: {
    value: "text-coin text-glow-coin",
    bloom:
      "group-hover:[filter:drop-shadow(0_0_2px_rgb(255_194_39/0.95))_drop-shadow(0_0_10px_rgb(255_194_39/0.55))]",
  },
};

/**
 * One cell of the phone HUD: a caption that says what the number *is*,
 * and the number.
 *
 * Notched with a hairline the cheap way — a 1px blue-dim parent notch
 * around a surface child notch — because a real border would be clipped
 * off the corners. The hover bloom sits on the outermost element for the
 * same reason (see "The trap" in CLAUDE.md), spelled as an arbitrary
 * `filter` because the `.bloom-*` classes are plain CSS in `@layer
 * utilities` and Tailwind v4 will not put a variant on those.
 */
function HudCell({
  label,
  icon,
  tone,
  href,
  children,
}: {
  label: string;
  icon?: IconName;
  tone: HudTone;
  href?: string;
  children: ReactNode;
}) {
  const body = (
    <div className="frame-notch bg-blue-dim/70 p-px transition-colors group-hover:bg-blue">
      <div className="frame-notch flex h-full flex-col justify-between gap-1 bg-surface-2 px-2.5 py-1.5">
        <span className="flex items-center gap-1.5">
          {icon ? (
            <Icon
              name={icon}
              size={12}
              glow={tone === "coin" ? "coin" : true}
            />
          ) : null}
          <Label tone="muted" className="text-[10px] leading-3 font-semibold">
            {label}
          </Label>
        </span>
        <span
          className={cn(
            "flex h-[18px] items-center font-pixel text-[13px] leading-[18px] tabular-nums",
            HUD_TONES[tone].value,
          )}
        >
          {children}
        </span>
      </div>
    </div>
  );

  const shell = cn(
    "group block min-w-0 flex-1 transition-[filter] duration-200",
    HUD_TONES[tone].bloom,
  );

  return href ? (
    <Link href={href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/* ============================================================== bottom */

/**
 * The phone tab bar: Feed, Board, [action], Wars, Shop.
 *
 * Five equal columns with the action in the third, raised half out of the
 * bar on a notched, lit plate — the only control in the bar with a fill,
 * and the only one that breaks its top edge, so it is found without
 * looking. Hidden from `md`, where the top bar carries everything.
 */
export function TabBar() {
  const pathname = usePathname();
  const { data } = useDashboard();
  const action = actionFor(data?.enrolment);
  const [left, right] = [PLACES.slice(0, 2), PLACES.slice(2)];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 bg-void/90 backdrop-blur-md md:hidden"
    >
      <Rule />
      <div className="scanlines mx-auto grid w-full max-w-lg grid-cols-5 items-end px-1 pb-[env(safe-area-inset-bottom)]">
        {left.map((place) => (
          <PlaceTab
            key={place.href}
            place={place}
            active={isActive(pathname, place.href)}
          />
        ))}
        <ActionTab action={action} active={isActive(pathname, action.href)} />
        {right.map((place) => (
          <PlaceTab
            key={place.href}
            place={place}
            active={isActive(pathname, place.href)}
          />
        ))}
      </div>
    </nav>
  );
}

function PlaceTab({ place, active }: { place: Place; active: boolean }) {
  return (
    <Link
      href={place.href}
      aria-current={active ? "page" : undefined}
      className="group relative flex min-w-0 flex-col items-center gap-1.5 pt-3 pb-2.5"
    >
      <Icon
        name={place.icon}
        size="sm"
        glow={active}
        dim={!active}
        className={
          active ? "" : "opacity-70 transition-opacity group-hover:opacity-100"
        }
      />
      <span
        className={cn(
          "font-pixel text-[9px] uppercase tracking-[0.08em]",
          active
            ? "text-cyan text-glow-cyan"
            : "text-ink-muted transition-colors group-hover:text-ink",
        )}
      >
        {place.label}
      </span>
      <AnimatePresence>
        {active ? (
          <motion.span
            layoutId="mobile-place-marker"
            aria-hidden
            className="absolute inset-x-4 top-0 h-px bg-cyan shadow-[var(--glow-cyan)]"
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          />
        ) : null}
      </AnimatePresence>
    </Link>
  );
}

/**
 * The raised action. `-mt-5` lifts the plate out of the bar; the label
 * stays on the bar's baseline with the others, so the row of words still
 * reads as one line. Bloom on the outer element, notch on the inner —
 * the trap again.
 */
function ActionTab({ action, active }: { action: Action; active: boolean }) {
  return (
    <Link
      href={action.href}
      aria-current={active ? "page" : undefined}
      aria-label={action.label}
      className="group flex flex-col items-center gap-1.5 pb-2.5"
    >
      <span className="-mt-5 block bloom-cyan transition-[filter] duration-200 group-active:scale-95">
        <span className="frame-notch block bg-cyan p-px">
          <span
            className={cn(
              "frame-notch flex size-14 items-center justify-center transition-colors",
              active ? "bg-blue-deep" : "bg-blue-dim group-hover:bg-blue-deep",
            )}
          >
            <Icon name={action.icon} size="md" glow="lg" />
          </span>
        </span>
      </span>
      <span className="font-pixel text-[9px] uppercase tracking-[0.1em] text-cyan text-glow-cyan">
        {action.label}
      </span>
    </Link>
  );
}

/* --------------------------------------------------------------- back */

/** A back affordance for a detail screen. Marker, label, nothing else. */
export function BackLink({
  href,
  children = "Back",
}: {
  href: string;
  children?: string;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 py-3 font-pixel text-[9px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-cyan"
    >
      <Icon
        name="arrow-left"
        size="xs"
        className="opacity-60 transition-opacity group-hover:opacity-100"
      />
      {children}
    </Link>
  );
}
