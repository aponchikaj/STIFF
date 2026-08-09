"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { AsteriskMark } from "./asterisk-mark";

/** Hero that reacts to scroll: content drifts up and fades while the
 *  asterisk slowly rotates out. */
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
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);

  return (
    <section
      ref={ref}
      className="flex h-[87svh] items-center justify-center px-6"
    >
      <motion.div
        style={reduce ? undefined : { opacity, y, scale }}
        className="flex items-center gap-4 sm:gap-6"
      >
        <motion.span style={reduce ? undefined : { rotate }}>
          <AsteriskMark className="size-16 sm:size-28" />
        </motion.span>
        <h1 className="text-7xl uppercase leading-none tracking-tight sm:text-9xl">
          Stiff
        </h1>
      </motion.div>
    </section>
  );
}
