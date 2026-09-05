const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_FAILED"
  | "INTERNAL_ERROR";

export interface ApiErrorDetail {
  path: (string | number)[];
  message: string;
}

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetail[];
}

interface ApiSuccessEnvelope<T> {
  success?: true; // backend doesn't always send this on success, only checked on failure
  data: T;
  pagination?: Pagination;
}

interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorPayload;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---- Typed error class ----
// Every failure from apiClient throws this — hooks and forms can rely on
// `error instanceof ApiError` and read `.code`/`.details` directly.

export class ApiError extends Error {
  code: ApiErrorCode;
  details?: ApiErrorDetail[];
  status: number;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }

  // Convenience for mapping VALIDATION_FAILED details onto a react-hook-form
  // field error map: { "name": "Required", "subitems.0.quantity": "..." }
  fieldErrors(): Record<string, string> {
    if (!this.details) return {};
    return Object.fromEntries(
      this.details.map((d) => [d.path.join("."), d.message]),
    );
  }
}

// ---- Core request function ----

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  searchParams?: URLSearchParams | Record<string, string | undefined>;
  signal?: AbortSignal;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; pagination?: Pagination }> {
  const { method = "GET", body, searchParams, signal } = options;

  const url = new URL(path, API_BASE_URL);
  if (searchParams) {
    const params =
      searchParams instanceof URLSearchParams
        ? searchParams
        : new URLSearchParams(
            Object.entries(searchParams).filter(
              (entry): entry is [string, string] => entry[1] !== undefined,
            ),
          );
    url.search = params.toString();
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      credentials: "include", // sends the better-auth session cookie
      headers:
        body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    // Network failure — no response at all (offline, CORS block, DNS, etc.)
    throw new ApiError(0, {
      code: "INTERNAL_ERROR",
      message: err instanceof Error ? err.message : "Network request failed",
    });
  }

  // Some endpoints (e.g. a bare delete) may return 204 with no body
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok || json?.success === false) {
    const errorPayload: ApiErrorPayload = json?.error ?? {
      code: "INTERNAL_ERROR",
      message: response.statusText || "Unknown error",
    };
    throw new ApiError(response.status, errorPayload);
  }

  return json as ApiSuccessEnvelope<T>;
}

// ---- Public client ----

export const apiClient = {
  get: <T>(
    path: string,
    searchParams?: RequestOptions["searchParams"],
    signal?: AbortSignal,
  ) => request<T>(path, { method: "GET", searchParams, signal }),

  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", body, signal }),

  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "PATCH", body, signal }),

  delete: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { method: "DELETE", signal }),
};
