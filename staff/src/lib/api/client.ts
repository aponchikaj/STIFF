const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:4000/api");

const ACCESS_KEY = "stiff_staff_access_token";
const REFRESH_KEY = "stiff_staff_refresh_token";

export function saveTokens(tokens: {
  accessToken?: string;
  refreshToken?: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    if (tokens.accessToken) localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    if (tokens.refreshToken)
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  } catch {
    // cookies remain the only transport
  }
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
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

function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

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
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const access = getAccessToken();
  if (access) headers["Authorization"] = `Bearer ${access}`;

  return fetch(buildUrl(path, query), {
    method,
    credentials: "include",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let refreshPromise: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    const stored = getStoredRefreshToken();
    refreshPromise = fetch(`${API_URL}/staff/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stored ? { refreshToken: stored } : {}),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        try {
          const data = (await res.json()) as {
            accessToken?: string;
            refreshToken?: string;
          };
          saveTokens(data);
        } catch {
          // cookies were still rotated
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

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const res = await rawFetch(path, options);

  if (res.status === 401 && !path.startsWith("/staff/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return parseResponse<T>(await rawFetch(path, options));
    }
  }

  return parseResponse<T>(res);
}
