import Link from "next/link";
import { btnOutline } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-start gap-4 py-20">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
        404
      </p>
      <h2 className="text-3xl uppercase tracking-tight sm:text-4xl">
        No such section
      </h2>
      <p className="max-w-prose text-xs leading-6 text-muted">
        That URL is not part of the panel.
      </p>
      <Link href="/" className={btnOutline}>
        Back to overview
      </Link>
    </div>
  );
}
