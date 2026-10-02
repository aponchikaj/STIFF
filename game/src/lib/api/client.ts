/**
 * The transport. Every call to the Nest API goes through `apiFetch`.
 *
 * This is deliberately the same contract the shop's client uses
 * (`frontend/src/lib/api/client.ts`) rather than a second one, because it is
 * the *same session*. A visitor who signed in on stiff.ge and walks over here
 * is already authenticated, and the game's sign-up (`POST /game/register`)
 * mints an ordinary shop token — there is no separate game account. Two
 * clients with two refresh strategies would eventually disagree about who is
 * signed in, and the symptom would be a silent logout mid-task with a clock
 * running.
 *
 * Shop tokens carry **no audience**. That matters: `JwtAuthGuard` rejects a
 * staff or admin token presented here even though the signing secret is
 * shared, so an admin cannot drive a player's session from the panel.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:4000/api");

/* Bearer-token fallback. httpOnly cookies are the primary transport, but the
 * game is served from a different registrable domain than the API, so every
 * request is cross-site and a browser may refuse the cookie outright. Tokens
 * returned by the auth endpoints are therefore also kept in localStorage and
 * sent as an Authorization header. Same keys as the shop, on purpose. */
const ACCESS_KEY = "stiff_access_token";
const REFRESH_KEY = "stiff_refresh_token";

export function saveTokens(tokens: {
  accessToken?: string;
  refreshToken?: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    if (tokens.accessToken) localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    if (tokens.refreshToken) localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  } catch {
    // Storage unavailable (private mode, blocked). Cookies remain the only
    // transport, which is fine when they are not being blocked too.
  }
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

/**
 * What to show a person for any failure a mutation can throw.
 *
 * Not every failure is an `ApiError`. When the request never reaches the
 * API — server down, offline, CORS — `fetch` throws a bare `TypeError` with
 * no `messages`, and casting that to `ApiError` crashes the form that was
 * only trying to report it.
 */
export function errorMessages(error: unknown): string[] {
  if (!error) return [];
  if (error instanceof ApiError) return error.messages.length ? error.messages : [error.message];
  if (error instanceof TypeError) return ["Can't reach the server. Try again in a moment."];
  if (error instanceof Error && error.message) return [error.message];
  return ["Something went wrong. Try again."];
}

/**
 * A failed request, with the validation messages intact.
 *
 * The backend runs a global `ValidationPipe`, so a 400 carries an *array* of
 * messages — one per failed constraint. Collapsing that to a single string
 * loses the per-field detail a form needs, so both are kept.
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

  /** Not signed in, or the session expired and could not be refreshed. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** Signed in, but not allowed — wrong role, wrong side, not enrolled. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** Throttled. Every mutating game route carries a `@Throttle`. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** A rule said no: clock expired, out of hearts, not enough coins. */
  get isConflict(): boolean {
    return this.status === 409;
  }
}

export type QueryValue = string | number | boolean | undefined | null;
export type QueryParams = Record<string, QueryValue>;

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: QueryParams;
  /** Skip the transparent refresh — for calls where a 401 is the answer. */
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = `${API_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    // null and undefined both mean "not set". Sending `?day=undefined` would
    // fail the ValidationPipe rather than be ignored.
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function rawFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  const { method = "GET", body, query, signal } = options;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = {};
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  const access = getAccessToken();
  if (access) headers["Authorization"] = `Bearer ${access}`;

  return fetch(buildUrl(path, query), {
    method,
    credentials: "include",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    signal,
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
  });
}

/* Deduped. The dashboard fires several queries at once, so an expired token
 * produces a burst of 401s — without this they would each refresh, and the
 * backend rotates the refresh token, so all but one would be rejected and
 * sign the player out. */
let refreshPromise: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    const stored = getStoredRefreshToken();
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stored ? { refreshToken: stored } : {}),
    })
      .then(async (res) => {
        if (!res.ok) {
          clearTokens();
          return false;
        }
        try {
          saveTokens(
            (await res.json()) as { accessToken?: string; refreshToken?: string },
          );
        } catch {
          // Body unreadable, but the cookies were still rotated.
        }
        return true;
      })
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
 * Routes where a 401 *is* the answer — bad credentials, a wrong password —
 * so refreshing and retrying would only produce a second failure.
 *
 * Deliberately a list rather than "anything under `/auth/`". `/auth/me` is
 * how the app learns who is signed in, and the access token lives fifteen
 * minutes: excluding it signed everyone out a quarter of an hour after they
 * signed in, with thirty days of refresh token still sitting in storage.
 */
const NO_REFRESH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/account",
  "/game/register",
]);

/**
 * The one call everything else is built on.
 *
 * On a 401 it refreshes once and retries, except on the routes above.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const res = await rawFetch(path, options);

  if (res.status === 401 && !NO_REFRESH_PATHS.has(path) && !options.skipRefresh) {
    if (await tryRefresh()) {
      return parseResponse<T>(await rawFetch(path, options));
    }
  }

  return parseResponse<T>(res);
}

/** Turn an API-relative path into one a `<video>` or `<img>` can request. */
export function resolveApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * `PUT` a file straight at object storage.
 *
 * Deliberately *not* `apiFetch`: the signed URL from `requestUpload` is not
 * our origin, carries its own auth in the query string, and would reject the
 * Authorization header this client otherwise attaches. The `Content-Type`
 * must be byte-identical to what was signed or the storage rejects it.
 */
export async function uploadToSignedUrl(
  uploadUrl: string,
  file: Blob,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  // XHR rather than fetch: a hand-in is up to 40 MB on a phone, and fetch
  // still cannot report upload progress. A player staring at a dead bar
  // during the last minute of a clock will assume it broke.
  if (onProgress && typeof XMLHttpRequest !== "undefined") {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new ApiError(xhr.status, ["Upload failed"]));
      xhr.onerror = () => reject(new ApiError(0, ["Upload failed"]));
      xhr.onabort = () => reject(new ApiError(0, ["Upload cancelled"]));
      xhr.send(file);
    });
    return;
  }

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) throw new ApiError(res.status, ["Upload failed"]);
}
