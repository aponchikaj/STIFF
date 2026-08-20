"use client";

import { useEffect, useRef, useState } from "react";
import { WALLPAPER_SIZES, wallpaperUrl } from "@/lib/image";
import { btnOutline } from "./ui";

/**
 * Takes a shot home as a wallpaper.
 *
 * Costs nothing to run — Cloudinary does the crop on delivery — and puts the
 * archive on someone's lock screen, which is a better placement than anything
 * that could be bought.
 *
 * These are plain links, not scripted downloads: the file is delivered with
 * `Content-Disposition: attachment`, so the browser saves it. The `download`
 * attribute would not have worked, being ignored cross-origin.
 */
export function WallpaperButton({
  src,
  filename,
  rotation = 0,
}: {
  src: string;
  filename: string;
  rotation?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Nothing to offer for an image that isn't on the CDN that does the cropping.
  if (!wallpaperUrl(src, WALLPAPER_SIZES[0], filename, rotation ?? 0)) {
    return null;
  }

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((was) => !was)}
        className={btnOutline}
      >
        Wallpaper
      </button>

      {open && (
        <ul
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-48 border border-subtle bg-background p-1 shadow-lg"
        >
          {WALLPAPER_SIZES.map((size) => (
            <li key={size.label} role="none">
              <a
                role="menuitem"
                href={
                  wallpaperUrl(src, size, filename, rotation ?? 0) ?? undefined
                }
                onClick={() => setOpen(false)}
                className="flex items-baseline justify-between gap-3 rounded-[2px] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
              >
                {size.label}
                <span className="text-[10px] tabular-nums opacity-60">
                  {size.width}×{size.height}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
