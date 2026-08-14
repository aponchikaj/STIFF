"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Browser-level friction against capture and sharing. This cannot stop an
 * OS screenshot (iOS/Android ignore the web for that) — the serial watermark
 * is the actual deterrent. Everything here is extra sand in the gears.
 */
export function usePrivatePlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): boolean {
  const [veiled, setVeiled] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setVeiled(false);
      return;
    }

    const video = videoRef.current;

    const veil = () => {
      setVeiled(true);
      video?.pause();
    };
    const unveil = () => {
      if (document.visibilityState === "visible") setVeiled(false);
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") veil();
      else unveil();
    };
    const onBlur = () => veil();
    const onFocus = () => unveil();
    const block = (event: Event) => event.preventDefault();
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "printscreen") veil();
      if ((event.metaKey || event.ctrlKey) && ["s", "p", "u"].includes(key)) {
        event.preventDefault();
      }
      if (event.key === "F12") event.preventDefault();
      if (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) {
        event.preventDefault();
      }
    };
    const onPip = (event: Event) => {
      event.preventDefault();
      video?.pause();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("dragstart", block);
    window.addEventListener("keydown", onKey);
    video?.addEventListener("enterpictureinpicture", onPip);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("dragstart", block);
      window.removeEventListener("keydown", onKey);
      video?.removeEventListener("enterpictureinpicture", onPip);
    };
  }, [videoRef, enabled]);

  return veiled;
}
