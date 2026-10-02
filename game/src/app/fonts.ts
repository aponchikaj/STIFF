import { Press_Start_2P } from "next/font/google";

/**
 * Press Start 2P — the arcade voice. Labels, buttons, HUD numbers.
 *
 * Self-hosted by `next/font` at build time, so there is no runtime request
 * to Google and no layout shift. One weight exists; there is no bold.
 *
 * It is also the *fallback* for the display role until PPNeueBit is
 * licensed and dropped into `public/fonts/` — see that folder's README.
 * The two are both pixel faces but are not metrically compatible, so
 * headline line-breaks will move when the real file lands.
 */
export const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap",
  // The pixel face has no italic and no alternate; a synthesised fallback
  // would be a smooth sans, which is worse than waiting.
  fallback: ["Courier New", "monospace"],
});
