import Link from "next/link";
import { AsteriskMark } from "@/components/asterisk-mark";
import { Magnetic } from "@/components/motion";

export default function NotFound() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="font-display text-7xl leading-none tracking-tight sm:text-9xl">
          4
        </span>
        <AsteriskMark className="spin-on-hover size-14 sm:size-24" />
        <span className="font-display text-7xl leading-none tracking-tight sm:text-9xl">
          4
        </span>
      </div>
      <p className="text-sm font-medium uppercase tracking-[0.35em] text-muted">
        Page not found
      </p>
      <Magnetic className="mt-2">
        <Link
          href="/"
          className="flex h-11 items-center rounded-[2px] bg-foreground px-6 text-xs font-bold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Back home
        </Link>
      </Magnetic>
    </section>
  );
}
