"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { reactionsApi } from "@/lib/api";
import type { ReactionType, TargetType } from "@/lib/api";
import { useSession } from "./providers";

export function ReactionButtons({
  targetType,
  targetId,
  likeCount,
  dislikeCount,
  myReaction,
}: {
  targetType: TargetType;
  targetId: string;
  likeCount: number;
  dislikeCount: number;
  myReaction: ReactionType | null;
}) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [counts, setCounts] = useState({ likeCount, dislikeCount });
  const [mine, setMine] = useState<ReactionType | null>(myReaction);
  const [busy, setBusy] = useState(false);

  async function toggle(type: ReactionType) {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setBusy(true);
    try {
      const result = await reactionsApi.toggleReaction(
        targetType,
        targetId,
        type,
      );
      setCounts({
        likeCount: result.likeCount,
        dislikeCount: result.dislikeCount,
      });
      setMine(result.myReaction);
    } catch {
      // leave counts as they were
    } finally {
      setBusy(false);
    }
  }

  const base =
    "flex h-9 items-center gap-2 rounded-[2px] px-4 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:opacity-60";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        aria-pressed={mine === "like"}
        onClick={() => toggle("like")}
        className={`${base} ${
          mine === "like"
            ? "bg-foreground text-background"
            : "border border-subtle text-muted hover:border-foreground hover:text-foreground"
        }`}
      >
        Like
        <span className="font-bold">{counts.likeCount}</span>
      </button>
      <button
        type="button"
        disabled={busy}
        aria-pressed={mine === "dislike"}
        onClick={() => toggle("dislike")}
        className={`${base} ${
          mine === "dislike"
            ? "bg-foreground text-background"
            : "border border-subtle text-muted hover:border-foreground hover:text-foreground"
        }`}
      >
        Dislike
        <span className="font-bold">{counts.dislikeCount}</span>
      </button>
    </div>
  );
}
