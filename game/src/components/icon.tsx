import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  ICON_ASPECT,
  ICON_SIZES,
  buttonIconSrc,
  iconSrc,
  type ButtonIconName,
  type IconName,
  type IconSize,
} from "@/lib/icons";

interface IconProps {
  name: IconName;
  /** A ladder step, or a number if you know what you are doing. */
  size?: IconSize | number;
  /** Adds bloom on top of the baked-in glow. Use for hover/active, not rest. */
  glow?: boolean | "lg" | "heart" | "coin";
  /** Spent heart, locked item, disabled control. */
  dim?: boolean;
  className?: string;
  /**
   * Decorative by default. Pass a label only when the icon is the *only*
   * carrier of the meaning — an icon beside its own text label is noise to
   * a screen reader, not help.
   */
  label?: string;
  priority?: boolean;
}

function glowClass(glow: IconProps["glow"]): string | undefined {
  if (!glow) return undefined;
  if (glow === "lg") return "icon-glow-lg";
  if (glow === "heart") return "icon-glow-heart";
  if (glow === "coin") return "icon-glow-coin";
  return "icon-glow";
}

/**
 * One pixel icon.
 *
 * `unoptimized` is deliberate and load-bearing. These are already small
 * transparent webps drawn on an 8px grid; running them through the Next
 * image optimizer re-encodes and resamples them, which is precisely what
 * destroys pixel art. It also means `sizes` and `quality` are irrelevant
 * here, so they are not exposed.
 */
export function Icon({
  name,
  size = "md",
  glow,
  dim,
  className,
  label,
  priority,
}: IconProps) {
  const px = typeof size === "number" ? size : ICON_SIZES[size];
  // `size` means "how tall", so a non-square glyph keeps its proportions by
  // narrowing rather than by overflowing the row it sits in.
  const aspect = ICON_ASPECT[name];
  const width = aspect ? Math.round(px * aspect) : px;

  return (
    <Image
      src={iconSrc(name)}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      width={width}
      height={px}
      priority={priority}
      unoptimized
      draggable={false}
      className={cn(
        "pixelated select-none",
        glowClass(glow),
        dim && "icon-dim",
        className,
      )}
    />
  );
}

interface ButtonIconProps extends Omit<IconProps, "name"> {
  name: ButtonIconName;
}

/**
 * One of the six drawn button faces (PLAY, PAUSE, ACCEPT, DECLINE, NEXT,
 * BACK). These are wider than they are tall in content but square in the
 * raster, and they carry their own frame — do not wrap one in `.frame-notch`
 * or it will be double-framed.
 */
export function ButtonIcon({
  name,
  size = "lg",
  glow,
  dim,
  className,
  label,
  priority,
}: ButtonIconProps) {
  const px = typeof size === "number" ? size : ICON_SIZES[size];
  return (
    <Image
      src={buttonIconSrc(name)}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      width={px}
      height={px}
      priority={priority}
      unoptimized
      draggable={false}
      className={cn(
        "pixelated select-none",
        glowClass(glow),
        dim && "icon-dim",
        className,
      )}
    />
  );
}
