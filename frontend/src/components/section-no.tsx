"use client";

import { useSession } from "./providers";

/** Sections 01–03 are shop-gated. When the shop is off they disappear, so the
 *  remaining eyebrows have to close the gap instead of starting the page at 04. */
const SHOP_SECTIONS = 3;

export function SectionNo({ n }: { n: number }) {
  const { shopEnabled } = useSession();
  const shown = shopEnabled ? n : n - SHOP_SECTIONS;
  return <>{String(shown).padStart(2, "0")}</>;
}
