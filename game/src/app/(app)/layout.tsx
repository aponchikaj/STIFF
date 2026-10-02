import type { ReactNode } from "react";
import { StatusStrip, TabBar } from "@/components/nav";

/**
 * The chrome every in-game screen shares.
 *
 * `pb-28` is not decoration: the phone tab bar is `fixed` (and its action
 * button rises above it), so without bottom padding the last row of every
 * list sits underneath it and cannot be tapped. From `md` there is no
 * bottom bar — the top bar carries the navigation — so the padding goes.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <StatusStrip />
      <div className="flex-1 pb-28 md:pb-10">{children}</div>
      <TabBar />
    </div>
  );
}
