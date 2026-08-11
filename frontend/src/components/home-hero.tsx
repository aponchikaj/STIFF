"use client";

import Image from "next/image";
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

/** Conversion-focused hero with 3D scroll depth: the block tilts back,
 *  drifts up and fades while the asterisk rotates out. */
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
  const rotateX = useTransform(scrollYProgress, [0, 1], [0, 24]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);

  return (
    <section
      ref={ref}
      style={{ perspective: 1000 }}
      className="relative flex h-dvh flex-col items-center justify-center overflow-hidden px-6"
    >
      {/* Backdrop: the one photograph on the page. Scrimmed hard through the
          middle so the centred column keeps its contrast in both themes. */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <Image
          src="/hero-cat.jpg"
          alt=""
          fill
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
          className="hero-photo object-cover object-bottom"
        />
        <div className="hero-scrim absolute inset-0" />
      </div>

      {/* Corner crosshairs */}
      <span aria-hidden="true" className="absolute left-4 top-4 select-none text-sm text-muted sm:left-6 sm:top-6">+</span>
      <span aria-hidden="true" className="absolute right-4 top-4 select-none text-sm text-muted sm:right-6 sm:top-6">+</span>
      <span aria-hidden="true" className="absolute bottom-4 left-4 select-none text-sm text-muted sm:bottom-6 sm:left-6">+</span>
      <span aria-hidden="true" className="absolute bottom-4 right-4 select-none text-sm text-muted sm:bottom-6 sm:right-6">+</span>

      <motion.div
        style={reduce ? undefined : { opacity, y, scale, rotateX }}
        className="relative flex flex-col items-center text-center"
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
              <Link
                href="/clothing"
                className={`${btnSolid} active:scale-[0.98]`}
              >
                Shop the drop
              </Link>
            </Magnetic>
          </IfShop>
          <Magnetic className="inline-block">
            <Link
              href="/gallery"
              className={`${btnOutline} h-12 px-6 active:scale-[0.98]`}
            >
              See the archive
            </Link>
          </Magnetic>
        </div>
        <p className="mt-10 text-[10px] font-medium uppercase tracking-[0.25em] text-muted">
          [ 41.7151° N, 44.8271° E — Tbilisi ]
        </p>
      </motion.div>
    </section>
  );
}
