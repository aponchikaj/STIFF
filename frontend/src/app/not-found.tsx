import Link from "next/link";
import { AsteriskMark } from "@/components/asterisk-mark";

export default function NotFound() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="text-7xl leading-none tracking-tight sm:text-9xl">
          4
        </span>
        <AsteriskMark className="size-14 text-zinc-50 sm:size-24" />
        <span className="text-7xl leading-none tracking-tight sm:text-9xl">
          4
        </span>
      </div>
      <p className="text-sm uppercase tracking-[0.35em] text-zinc-400">
        Page not found
      </p>
      <Link
        href="/"
        className="mt-2 flex h-11 items-center rounded-full bg-zinc-50 px-6 text-xs uppercase tracking-[0.2em] text-zinc-950 transition-colors hover:bg-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
      >
        Back home
      </Link>
    </section>
  );
}
