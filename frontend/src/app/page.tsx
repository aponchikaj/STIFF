function AsteriskMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="95 -688 365 366"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* Exact asterisk glyph outline extracted from ArchivoBlack-Regular.ttf */}
      <g transform="scale(1 -1)">
        <path d="M413 637 460 557 348 505 460 454 413 373 312 444 324 322H231L243 444L142 373L95 454L207 505L95 557L142 637L243 566L231 688H324L312 567Z" />
      </g>
    </svg>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-50">
      <main className="flex flex-col items-center gap-5 text-center">
        <div className="flex items-center gap-4 sm:gap-6">
          <AsteriskMark className="size-16 sm:size-28" />
          <h1 className="text-7xl uppercase leading-none tracking-tight sm:text-9xl">
            Stiff
          </h1>
        </div>
        <p className="text-base uppercase tracking-[0.35em] text-zinc-400">
          Coming soon
        </p>
      </main>
    </div>
  );
}
