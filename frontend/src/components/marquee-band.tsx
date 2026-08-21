import { contentText, fetchContent } from "@/lib/content-server";
import { AsteriskMark } from "./asterisk-mark";

/** Enough copies that the track is wider than any viewport before it loops. */
const REPEATS = 8;

function Row({ words }: { words: string[] }) {
  return (
    <div className="flex shrink-0 items-center">
      {Array.from({ length: REPEATS }).map((_, i) => (
        <span
          key={i}
          className="flex items-center gap-6 pr-6 sm:gap-10 sm:pr-10"
        >
          <AsteriskMark className="size-7 sm:size-10" />
          <span className="font-display text-4xl uppercase leading-none tracking-tight sm:text-6xl">
            {/* Several words cycle rather than repeat, so a band reading
                "Stiff / Drop 01 / Tbilisi" says three things per pass. */}
            {words[i % words.length]}
          </span>
        </span>
      ))}
    </div>
  );
}

export async function MarqueeBand() {
  const copy = await fetchContent("home-marquee");
  const words = contentText(copy, "words", "Stiff")
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
  const list = words.length > 0 ? words : ["Stiff"];

  return (
    <div
      aria-hidden="true"
      className="marquee-band flex h-[12dvh] min-h-20 items-center overflow-hidden bg-foreground text-background"
    >
      {/* Two identical rows; the track slides -50% and loops seamlessly */}
      <div className="marquee-track flex">
        <Row words={list} />
        <Row words={list} />
      </div>
    </div>
  );
}
