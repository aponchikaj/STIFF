"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { AsteriskMark } from "./asterisk-mark";
import { IfShop } from "./if-shop";
import { Magnetic } from "./motion";
import { btnOutline, btnSolid } from "./ui";

/** Simple, conversion-focused hero: mark + promise + one clear action.
 *  Content drifts up and fades on scroll; the asterisk slowly rotates out. */
export function HomeHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const opacity = useTransform(scrollYProgress, [0, 0.9], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 270]);

  return (
    <section
      ref={ref}
      className="relative flex h-[87svh] flex-col items-center justify-center px-6"
    >
      <motion.div
        style={reduce ? undefined : { opacity, y }}
        className="flex flex-col items-center text-center"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-muted">
          Tbilisi — est. 2026
        </p>
        <div className="mt-6 flex items-center gap-4 sm:gap-6">
          <motion.span style={reduce ? undefined : { rotate }}>
            <AsteriskMark className="size-14 sm:size-24" />
          </motion.span>
          <h1 className="text-7xl uppercase leading-none tracking-tight sm:text-9xl">
            Stiff
          </h1>
        </div>
        <p className="mt-6 max-w-md text-sm leading-7 text-muted">
          Essential clothing. Nothing extra. Heavy fabric, hard cuts, one mark
          — made to be worn until it falls apart.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <IfShop>
            <Magnetic className="inline-block">
              <Link href="/clothing" className={btnSolid}>
                Shop the drop
              </Link>
            </Magnetic>
          </IfShop>
          <Magnetic className="inline-block">
            <Link href="/gallery" className={`${btnOutline} h-12 px-6`}>
              See the archive
            </Link>
          </Magnetic>
        </div>
      </motion.div>

      <motion.p
        style={reduce ? undefined : { opacity }}
        aria-hidden="true"
        className="absolute bottom-8 text-[10px] font-medium uppercase tracking-[0.35em] text-muted"
      >
        Scroll ↓
      </motion.p>
    </section>
  );
}
