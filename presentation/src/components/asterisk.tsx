import type { CSSProperties } from "react";

/** The six-armed mark from brand.md, drawn rather than typed. */
export function Asterisk({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      style={style}
      fill="none"
    >
      {[0, 60, 120].map((a) => (
        <line
          key={a}
          x1="12"
          y1="2"
          x2="12"
          y2="22"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="butt"
          transform={`rotate(${a} 12 12)`}
        />
      ))}
    </svg>
  );
}
