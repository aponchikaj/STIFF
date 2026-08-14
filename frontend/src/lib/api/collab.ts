import { apiFetch, resolveApiUrl } from "./client";
import type {
  CollabPlayback,
  CollabPublicConfig,
  CollabSessionView,
} from "./types";

export const COLLAB_SLUG = "keburia";
export const COLLAB_PENDING_KEY = "stiff_collab_pending_keburia";

export function getConfig(): Promise<CollabPublicConfig> {
  return apiFetch(`/collab/${COLLAB_SLUG}/config`, { skipRefresh: true });
}

export function redeem(
  token: string,
): Promise<{ serial: string; title: string; strictMode: boolean }> {
  return apiFetch(`/collab/${COLLAB_SLUG}/redeem`, {
    method: "POST",
    body: { token },
    skipRefresh: true,
  });
}

export function getSession(): Promise<CollabSessionView> {
  return apiFetch(`/collab/${COLLAB_SLUG}/session`, { skipRefresh: true });
}

export function getPlayback(): Promise<CollabPlayback> {
  return apiFetch(`/collab/${COLLAB_SLUG}/playback`, { skipRefresh: true });
}

export function playbackSrc(play: CollabPlayback): string {
  return play.mode === "proxy" ? resolveApiUrl(play.url) : play.url;
}
