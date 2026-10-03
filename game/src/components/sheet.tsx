"use client";

/**
 * A sheet: up from the bottom on a phone, a centred panel from `sm`.
 *
 * The one surface for "look closer, then decide" — a reward's details and
 * its buy button, an opal pack and its checkout. Escape, the backdrop and
 * the close button all dismiss it (unless `busy`: money mid-flight is not
 * walked away from by a stray tap), and the page behind does not scroll.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { Icon } from "@/components/icon";

export function Sheet({
  open,
  onClose,
  label,
  busy = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** For screen readers: what this sheet is. */
  label: string;
  busy?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, busy, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-void/85 backdrop-blur-sm"
            onClick={() => (busy ? undefined : onClose())}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-h-[92dvh] w-full overflow-y-auto overscroll-contain border-t border-blue-dim bg-surface pb-[env(safe-area-inset-bottom)] sm:max-w-lg sm:border"
          >
            <span aria-hidden className="mx-auto mt-2.5 block h-1 w-10 bg-blue-dim sm:hidden" />
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 p-2 opacity-60 transition-opacity hover:opacity-100 disabled:opacity-20"
            >
              <Icon name="close" size="sm" />
            </button>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
