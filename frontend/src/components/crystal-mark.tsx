import Image from "next/image";

/** The crystal — the brand's one licensed break from strict monochrome.
 *  Grayscale on the light theme, full cyan on the dark one (see .crystal
 *  in globals.css). Used sparingly: the intro loader and the low-stock mark. */
export function CrystalMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/crystal.png"
      alt=""
      aria-hidden="true"
      width={376}
      height={676}
      className={`crystal w-auto ${className}`}
    />
  );
}
