export function AsteriskMark({ className }: { className?: string }) {
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
