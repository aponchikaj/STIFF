import { SystemCheck } from "./system-check";

export const metadata = { title: "System check" };

/**
 * The reference page: every token, every icon, and a live probe of the API.
 *
 * This is the thing to open when something looks wrong. It answers three
 * questions that otherwise take an hour each — is the API reachable and
 * are the routes the shapes we think they are, did the fonts load, and is
 * the colour/glow/scanline stack compositing correctly on this browser.
 *
 * It is a developer tool, not a screen. It will not be designed.
 */
export default function SystemPage() {
  return <SystemCheck />;
}
