"use client";

/**
 * The opal, its chains and its lock.
 *
 * The stone is the brand's own opal glyph — the pixel gem from the icon
 * sheet, the same mark that stands for the currency — so the thing a player
 * unlocks is recognisably *the* opal and not a stock diamond. Everything
 * that has to move on its own is drawn in SVG around it: two chains that
 * each snap into two halves, a padlock that rattles and drops, the flash,
 * the rays, the shards of light the stone throws when it opens.
 *
 * Three layers, back to front: light (halo, rays) · the stone · iron and
 * effects (chains, lock, sparkles, shards, flash). One `useAnimate` scope
 * spans all three, so a ceremony can move any of them by `data-*` name.
 *
 * Four ceremonies, each an awaited sequence:
 *
 *   rattle  — a locked or closed opal was pressed. Chains shake, the lock
 *             swings, the stone shudders, and nothing opens.
 *   unseal  — the opal's hour came. The lock fights, then drops; the chains
 *             snap and fly; the stone takes its colour back.
 *   open    — the stone gathers, bursts — rays, shards, a white-out — and
 *             settles, lit and floating.
 *   seal    — played by itself when an open opal closes on screen: the
 *             chains slam back on and the light goes out.
 *
 * Reduced motion keeps every outcome and drops the movement.
 */

import { motion, useAnimate, useReducedMotion } from "framer-motion";
import { forwardRef, useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { Icon } from "@/components/icon";
import type { OpalState } from "@/lib/api";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------- geometry */

/** The drawing box. The stone fills 84% of its height. */
const W = 200;
const H = 220;
const CENTER = { x: 100, y: 112 } as const;

/** Server and browser must print the same transform — round, don't trust floats. */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Links along a line from `a` to `b`, alternating face-on and edge-on. */
function chainLinks(a: [number, number], b: [number, number], count: number) {
  const angle = r2((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI);
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    return {
      x: r2(a[0] + (b[0] - a[0]) * t),
      y: r2(a[1] + (b[1] - a[1]) * t),
      angle,
      face: i % 2 === 0,
    };
  });
}

const LINKS = 12;
/** Corner to corner, crossing on the lock. */
const CHAIN_A = chainLinks([14, 30], [186, 196], LINKS);
const CHAIN_B = chainLinks([186, 30], [14, 196], LINKS);

/** Shards of light thrown when the stone opens: 16 squares, all directions. */
const SHARDS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + (i % 2 ? 0.18 : 0);
  const reach = i % 3 === 0 ? 108 : i % 3 === 1 ? 84 : 66;
  return {
    id: i,
    x: r2(Math.cos(angle) * reach),
    y: r2(Math.sin(angle) * reach),
    size: i % 4 === 0 ? 6 : 4,
    fill: i % 5 === 0 ? "#ffffff" : i % 2 ? "#01e7ff" : "#9ff5ff",
  };
});

/** Four-point sparkles that glint on a lit stone, out of step. */
const SPARKLES = [
  { x: 64, y: 70, s: 1, delay: 0 },
  { x: 140, y: 150, s: 0.8, delay: 1.1 },
  { x: 128, y: 58, s: 0.6, delay: 2.2 },
];

/* ---------------------------------------------------------------- props */

export interface OpalArtHandle {
  rattle: () => Promise<void>;
  unseal: () => Promise<void>;
  open: () => Promise<void>;
}

interface OpalArtProps {
  state: OpalState;
  /** The chains are already gone (this device watched them break). */
  unsealed: boolean;
  /** This device has opened it: lit and floating. */
  opened: boolean;
  /** Lit, shut, and waiting for a press: the stone breathes. */
  inviting?: boolean;
  className?: string;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/**
 * The drawing. Imperative on purpose: the ceremonies are events, not
 * states — "the chains just broke" is something that *happens*, once — so
 * the parent calls `rattle`, `unseal` and `open` and awaits them.
 */
export const OpalArt = forwardRef(function OpalArt(
  { state, unsealed, opened, inviting = false, className }: OpalArtProps,
  ref: Ref<OpalArtHandle>,
) {
  const [scope, animate] = useAnimate();
  const reduce = useReducedMotion();

  const chained = state !== "open" || !unsealed;
  const lit = state === "open" && unsealed;
  const closed = state === "closed";

  /* ------------------------------------------------- seal, by itself */

  // An open opal that closes while it is on screen gets its chains back
  // with a slam, not a cut. Only on that transition — a page that loads on
  // a closed opal just shows it closed.
  const previous = useRef(state);
  useEffect(() => {
    const was = previous.current;
    previous.current = state;
    if (was !== "open" || state !== "closed" || reduce) return;
    void (async () => {
      await animate(
        "[data-chains]",
        { opacity: [0, 1], scale: [1.5, 1] },
        { duration: 0.32, ease: [0.55, 0, 1, 0.45] },
      );
      await animate("[data-gem]", { y: [0, 4, 0] }, { duration: 0.25 });
    })();
  }, [state, animate, reduce]);

  useImperativeHandle(
    ref,
    () => ({
      async rattle() {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.([24, 40, 24]);
        }
        if (reduce) {
          await animate("[data-chains]", { opacity: [1, 0.4, 1] }, { duration: 0.3 });
          return;
        }
        await Promise.all([
          animate(
            "[data-chains]",
            { x: [0, -8, 8, -6, 6, -3, 3, 0] },
            { duration: 0.5, ease: "easeOut" },
          ),
          animate(
            "[data-lock]",
            { rotate: [0, -16, 14, -10, 8, -4, 0] },
            { duration: 0.6, ease: "easeOut" },
          ),
          animate(
            "[data-gem]",
            { x: [0, -4, 4, -2, 2, 0] },
            { duration: 0.42, ease: "easeOut" },
          ),
          // A red pulse on the lock's rim: "no".
          animate("[data-deny]", { opacity: [0, 0.9, 0] }, { duration: 0.5 }),
        ]);
      },

      async unseal() {
        if (reduce) {
          await Promise.all([
            animate("[data-chains]", { opacity: 0 }, { duration: 0.4 }),
            animate("[data-gem]", { filter: LIT }, { duration: 0.4 }),
          ]);
          return;
        }
        const fly = { duration: 0.75, ease: [0.4, 0, 0.6, 1] as const };
        // The lock fights first, so the break reads as forced, not faded.
        await animate(
          "[data-lock]",
          { rotate: [0, -12, 12, -12, 12, -6, 0], y: [0, -3, 0, -3, 0] },
          { duration: 0.7 },
        );
        // The shackle springs.
        await animate("[data-shackle]", { y: -9 }, { duration: 0.14, ease: EASE_OUT });
        await Promise.all([
          animate(
            "[data-flash]",
            { opacity: [0, 0.95, 0], scale: [0.2, 1.7] },
            { duration: 0.55, ease: "easeOut" },
          ),
          animate(
            "[data-lock]",
            { y: 120, rotate: 38, opacity: 0 },
            { duration: 0.75, ease: [0.55, 0, 0.8, 0.2] },
          ),
          animate("[data-chain='a1']", { x: -80, y: -70, rotate: -28, opacity: 0 }, fly),
          animate("[data-chain='a2']", { x: 80, y: 70, rotate: 22, opacity: 0 }, fly),
          animate("[data-chain='b1']", { x: 80, y: -70, rotate: 28, opacity: 0 }, fly),
          animate("[data-chain='b2']", { x: -80, y: 70, rotate: -22, opacity: 0 }, fly),
          animate(
            "[data-gem]",
            { filter: LIT, scale: [1, 1.08, 1] },
            { duration: 0.9, delay: 0.15, ease: EASE_OUT },
          ),
          animate("[data-halo]", { opacity: [0, 1, 0.55] }, { duration: 1, delay: 0.15 }),
        ]);
      },

      async open() {
        if (reduce) {
          await animate("[data-flash]", { opacity: [0, 1, 0] }, { duration: 0.5 });
          return;
        }
        // Gather — the stone pulls in and heats up…
        await animate(
          "[data-gem]",
          { scale: 0.86, filter: HOT },
          { duration: 0.32, ease: [0.4, 0, 1, 1] },
        );
        // …burst: white-out, rays, shards, the stone lifts.
        await Promise.all([
          animate("[data-gem]", { scale: 1.22, y: -10 }, { duration: 0.42, ease: EASE_OUT }),
          animate(
            "[data-rays]",
            { opacity: [0, 1, 0], rotate: [0, 45], scale: [0.4, 1.6] },
            { duration: 1.2, ease: "easeOut" },
          ),
          animate(
            "[data-flash]",
            { opacity: [0, 1, 0], scale: [0.3, 2.6] },
            { duration: 0.85, ease: "easeOut" },
          ),
          animate("[data-ring]", { opacity: [0.9, 0], scale: [0.3, 2.2] }, {
            duration: 0.9,
            ease: "easeOut",
          }),
          ...SHARDS.map((s) =>
            animate(
              `[data-shard='${s.id}']`,
              { x: [0, s.x], y: [0, s.y], opacity: [1, 1, 0], rotate: [0, 180] },
              { duration: 0.9 + (s.id % 3) * 0.12, ease: EASE_OUT },
            ),
          ),
        ]);
        // …and settles, lit.
        await Promise.all([
          animate(
            "[data-gem]",
            { scale: 1, y: 0, filter: LIT },
            { duration: 0.6, ease: EASE_OUT },
          ),
          animate("[data-halo]", { opacity: 1 }, { duration: 0.6 }),
        ]);
      },
    }),
    [animate, reduce],
  );

  const resting = lit ? LIT : closed ? DEAD : LOCKED;

  return (
    <div ref={scope} className={cn("relative", className)}>
      {/* ---------------------------------------------------- light */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 block size-full overflow-visible"
        aria-hidden
      >
        <defs>
          <radialGradient id="opal-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#01e7ff" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#01a3ff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#01a3ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <motion.circle
          data-halo
          cx={CENTER.x}
          cy={CENTER.y}
          r={98}
          fill="url(#opal-halo)"
          initial={false}
          animate={{
            opacity: !lit ? 0 : opened ? 1 : inviting && !reduce ? [0.3, 0.95, 0.3] : 0.55,
          }}
          transition={
            inviting && !reduce
              ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.6 }
          }
        />

        {/* rays — only ever seen in the burst */}
        <g data-rays opacity={0} style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}>
          {Array.from({ length: 12 }, (_, i) => (
            <rect
              key={i}
              x={98}
              y={-14}
              width={4}
              height={74}
              fill="#e6fdff"
              opacity={i % 2 ? 0.45 : 0.9}
              transform={`rotate(${i * 30} ${CENTER.x} ${CENTER.y})`}
            />
          ))}
        </g>
      </svg>

      {/* ---------------------------------------------------- the stone */}
      {/* A plain element, not a `motion` one with an `animate` prop: the
          ceremonies drive this filter imperatively, and a declarative tween
          on the same value cancels theirs mid-flight — leaving its promise
          unsettled and the ceremony stuck. React writes `resting` only when
          it changes, which is always after the ceremony that changed it. */}
      <div
        data-gem
        className="absolute inset-x-0 top-[4%] flex h-[84%] justify-center"
        style={{ transformOrigin: "50% 55%", filter: resting }}
      >
        <div className={cn("h-full", lit && opened && "animate-float")}>
          {/* The invitation: a slow swell, so a shut stone reads as pressable. */}
          <motion.div
            className="h-full"
            animate={
              inviting && !reduce ? { scale: [1, 1.045, 1] } : { scale: 1 }
            }
            transition={
              inviting && !reduce
                ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.3 }
            }
          >
            <Icon name="opal" size={192} priority className="h-full w-auto" />
          </motion.div>
        </div>
      </div>

      {/* ---------------------------------------------- iron and effects */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 block size-full overflow-visible"
        aria-hidden
      >
        <defs>
          <radialGradient id="opal-flash" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="40%" stopColor="#9ff5ff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#01e7ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* glints on a lit stone */}
        {lit
          ? SPARKLES.map((s, i) => (
              <motion.path
                key={i}
                d="M0 -9 L2 -2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2 -2 Z"
                fill="#ffffff"
                transform={`translate(${s.x} ${s.y}) scale(${s.s})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  repeatDelay: 2.4,
                  delay: s.delay,
                  ease: "easeInOut",
                }}
              />
            ))
          : null}

        {/* the shockwave ring and shards of the burst */}
        <circle
          data-ring
          cx={CENTER.x}
          cy={CENTER.y}
          r={44}
          fill="none"
          stroke="#9ff5ff"
          strokeWidth={3}
          opacity={0}
          style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}
        />
        <g transform={`translate(${CENTER.x} ${CENTER.y})`} shapeRendering="crispEdges">
          {SHARDS.map((s) => (
            <rect
              key={s.id}
              data-shard={s.id}
              x={-s.size / 2}
              y={-s.size / 2}
              width={s.size}
              height={s.size}
              fill={s.fill}
              opacity={0}
            />
          ))}
        </g>

        {chained ? (
          <g
            data-chains
            shapeRendering="crispEdges"
            style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}
          >
            <Chain id="a1" links={CHAIN_A.slice(0, LINKS / 2)} closed={closed} />
            <Chain id="a2" links={CHAIN_A.slice(LINKS / 2)} closed={closed} />
            <Chain id="b1" links={CHAIN_B.slice(0, LINKS / 2)} closed={closed} />
            <Chain id="b2" links={CHAIN_B.slice(LINKS / 2)} closed={closed} />
            <Padlock closed={closed} />
          </g>
        ) : null}

        {/* the flash every ceremony shares */}
        <circle
          data-flash
          cx={CENTER.x}
          cy={CENTER.y}
          r={70}
          fill="url(#opal-flash)"
          opacity={0}
          style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}
        />
      </svg>
    </div>
  );
});

/* The stone's three looks, as CSS filters on the glyph. */
const LIT = "grayscale(0) brightness(1)";
const HOT = "grayscale(0) brightness(1.9)";
const LOCKED = "grayscale(0.85) brightness(0.55)";
const DEAD = "grayscale(1) brightness(0.3)";

/* ------------------------------------------------------------- chain */

function Chain({
  id,
  links,
  closed,
}: {
  id: string;
  links: ReturnType<typeof chainLinks>;
  closed: boolean;
}) {
  const steel = closed ? "#5d6b78" : "#8ba3b8";
  const shine = closed ? "#7f8d99" : "#d7e4ee";
  return (
    <g data-chain={id}>
      {links.map((l, i) =>
        l.face ? (
          <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.angle})`}>
            {/* a face-on link: an open rectangle, lit along the top */}
            <rect x={-9} y={-6} width={18} height={12} fill="none" stroke="#0a1016" strokeWidth={5} />
            <rect x={-9} y={-6} width={18} height={12} fill="none" stroke={steel} strokeWidth={3} />
            <rect x={-7} y={-6} width={10} height={1.5} fill={shine} />
          </g>
        ) : (
          <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.angle})`}>
            {/* an edge-on link: a solid bar through its neighbours */}
            <rect x={-8} y={-2.5} width={16} height={5} fill="#0a1016" />
            <rect x={-7} y={-1.5} width={14} height={3} fill={steel} />
            <rect x={-6} y={-1.5} width={8} height={1} fill={shine} />
          </g>
        ),
      )}
    </g>
  );
}

/* ------------------------------------------------------------ padlock */

function Padlock({ closed }: { closed: boolean }) {
  const body = closed ? "#4a5560" : "#6f8496";
  const rim = closed ? "#ff4d5e" : "#01e7ff";
  return (
    <g data-lock style={{ transformOrigin: "100px 104px" }}>
      {/* shackle: a squared arch, two legs and a bar */}
      <g data-shackle>
        <rect x={86} y={98} width={5} height={18} fill="#0a1016" />
        <rect x={109} y={98} width={5} height={18} fill="#0a1016" />
        <rect x={86} y={94} width={28} height={6} fill="#0a1016" />
        <rect x={87} y={99} width={3} height={16} fill="#c8d6e2" />
        <rect x={110} y={99} width={3} height={16} fill="#c8d6e2" />
        <rect x={87} y={95} width={26} height={4} fill="#c8d6e2" />
      </g>
      {/* body */}
      <rect x={80} y={113} width={40} height={32} fill="#0a1016" />
      <rect x={82} y={115} width={36} height={28} fill={body} />
      <rect x={82} y={115} width={36} height={3} fill={rim} opacity={0.85} />
      <rect x={82} y={140} width={36} height={3} fill="#0a1016" opacity={0.5} />
      {/* the refusal: the face flushes red for a beat */}
      <rect data-deny x={82} y={115} width={36} height={28} fill="#ff4d5e" opacity={0} />
      {/* keyhole */}
      <rect x={97} y={123} width={6} height={6} fill="#05080b" />
      <rect x={98.5} y={128} width={3} height={8} fill="#05080b" />
    </g>
  );
}
