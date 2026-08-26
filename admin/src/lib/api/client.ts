const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:4000/api");

/**
 * Cookies only.
 *
 * The shop's client also keeps tokens in localStorage as a fallback for
 * browsers that block third-party cookies. This one deliberately does not:
 * /api is proxied first-party from admin.stiff.ge, so the fallback would buy
 * nothing, and a token readable by script is a token an XSS can walk off with.
 * The session lives entirely in httpOnly cookies the page cannot see.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages[0] ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.messages = messages;
  }
}

export type QueryParams = Record<
  string,
  string | number | boolean | undefined
>;

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: QueryParams;
  /** Skip the transparent refresh — used by the session check itself. */
  skipRefresh?: boolean;
}

/**
 * Fired when the session is gone and a refresh could not bring it back. The
 * providers listen for this and send the browser to /login, so a expired
 * session surfaces as a sign-in prompt rather than a screen of failed panels.
 */
export const SESSION_ENDED_EVENT = "stiff-admin:session-ended";

function announceSessionEnded(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = `${API_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function rawFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  const { method = "GET", body, query } = options;
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = {};
  if (body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(buildUrl(path, query), {
    method,
    credentials: "include",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
  });
}

// Deduped: concurrent 401s trigger a single refresh round-trip.
let refreshPromise: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/admin/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const record = (data ?? {}) as Record<string, unknown>;
    const message = record["message"];
    const messages = Array.isArray(message)
      ? message.map(String)
      : typeof message === "string"
        ? [message]
        : [`Request failed with status ${res.status}`];
    throw new ApiError(res.status, messages);
  }

  return data as T;
}

/**
 * Core API client. Sends cookies, JSON-encodes bodies, and on a 401 from a
 * non-auth endpoint refreshes the admin session once and retries.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const res = await rawFetch(path, options);

  if (
    res.status === 401 &&
    !path.startsWith("/admin/auth/") &&
    !options.skipRefresh
  ) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return parseResponse<T>(await rawFetch(path, options));
    }
    announceSessionEnded();
  }

  return parseResponse<T>(res);
}

/** Turn a backend-relative path into a URL the video element can request. */
export function resolveApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}${suffix}`;
}

/** Fetch a binary export as a blob (QR PNG preview). */
export async function apiBlob(
  path: string,
  query?: QueryParams,
): Promise<Blob> {
  let res = await rawFetch(path, { method: "GET", query });
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await rawFetch(path, { method: "GET", query });
    else announceSessionEnded();
  }
  if (!res.ok) {
    await parseResponse(res);
    throw new ApiError(res.status, ["Download failed"]);
  }
  return res.blob();
}

/** Download a binary export (QR zip / PNG). */
export async function apiDownload(
  path: string,
  filename: string,
  query?: QueryParams,
): Promise<void> {
  const blob = await apiBlob(path, query);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
