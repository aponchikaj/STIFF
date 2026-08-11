import { AsteriskMark } from "./asterisk-mark";

function Row() {
  return (
    <div className="flex shrink-0 items-center">
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="flex items-center gap-6 pr-6 sm:gap-10 sm:pr-10"
        >
          <AsteriskMark className="size-7 sm:size-10" />
          <span className="font-display text-4xl uppercase leading-none tracking-tight sm:text-6xl">
            Stiff
          </span>
        </span>
      ))}
    </div>
  );
}

export function MarqueeBand() {
  return (
    <div
      aria-hidden="true"
      className="flex h-[12dvh] min-h-20 items-center overflow-hidden bg-foreground text-background"
    >
      {/* Two identical rows; the track slides -50% and loops seamlessly */}
      <div className="marquee-track flex">
        <Row />
        <Row />
      </div>
    </div>
  );
}
