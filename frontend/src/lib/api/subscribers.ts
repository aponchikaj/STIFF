import { apiFetch } from "./client";
import type {
  Paginated,
  Subscriber,
  SubscriberCounts,
  SubscriberStatus,
  SubscribeResult,
} from "./types";

/**
 * Joining the list.
 *
 * The response is deliberately the same whatever the server found — a form
 * that says "you are already subscribed" is a way to test whether an address
 * is on the list.
 */
export function subscribe(
  email: string,
  source: "home" | "footer" | "checkout" = "home",
): Promise<SubscribeResult> {
  return apiFetch("/subscribers", { method: "POST", body: { email, source } });
}

/** Both of these come from a link in an email, so neither needs a session. */
export function confirm(
  token: string,
): Promise<{ email: string; alreadyDone: boolean }> {
  return apiFetch("/subscribers/confirm", { method: "POST", body: { token } });
}

export function unsubscribe(token: string): Promise<{ email: string }> {
  return apiFetch("/subscribers/unsubscribe", {
    method: "POST",
    body: { token },
  });
}

// ---- admin ----

export function listSubscribers(params?: {
  page?: number;
  pageSize?: number;
  status?: SubscriberStatus;
}): Promise<Paginated<Subscriber>> {
  return apiFetch("/subscribers", { query: { ...params } });
}

/**
 * Email every confirmed subscriber.
 *
 * Confirmed only — the backend enforces it rather than trusting the caller,
 * because that is the promise made at signup.
 */
export function broadcastToList(
  title: string,
  body: string,
): Promise<{ sent: number; failed: number }> {
  return apiFetch("/subscribers/broadcast", {
    method: "POST",
    body: { title, body },
  });
}

export function subscriberCounts(): Promise<SubscriberCounts> {
  return apiFetch("/subscribers/counts");
}

export function deleteSubscriber(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/subscribers/${id}`, { method: "DELETE" });
}
