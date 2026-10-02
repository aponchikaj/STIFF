import type { ReactNode } from "react";

/**
 * A season has three opals, so there are three task pages and no others.
 * Listed here (the page itself is a client component) so `/play/007` is a
 * real 404 from the server, not a 200 that renders one.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ opal: "001" }, { opal: "002" }, { opal: "003" }];
}

export default function OpalLayout({ children }: { children: ReactNode }) {
  return children;
}
