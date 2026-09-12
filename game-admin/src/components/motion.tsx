"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Fade-up once as it enters the viewport. Transform + opacity only. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Scroll-linked drift, compositor-only via CSS `view()` timeline.
 * Disabled on coarse pointers and reduced-motion (see globals.css).
 */
export function Parallax({
  children,
  className,
}: {
  children: React.ReactNode;
  range?: number;
  className?: string;
}) {
  return <div className={`parallax ${className ?? ""}`}>{children}</div>;
}

/** Rotates its child as it travels through the viewport (CSS view timeline). */
export function ScrollSpin({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`scroll-spin ${className ?? ""}`}>{children}</div>;
}

export function Magnetic({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useRef<DOMRect | null>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15 });
  const sy = useSpring(y, { stiffness: 200, damping: 15 });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: sx, y: sy }}
      onPointerEnter={
        reduce
          ? undefined
          : () => {
              box.current = ref.current?.getBoundingClientRect() ?? null;
            }
      }
      onPointerMove={
        reduce
          ? undefined
          : (e) => {
              const r = box.current;
              if (!r) return;
              x.set((e.clientX - (r.left + r.width / 2)) * 0.3);
              y.set((e.clientY - (r.top + r.height / 2)) * 0.3);
            }
      }
      onPointerLeave={() => {
        box.current = null;
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
